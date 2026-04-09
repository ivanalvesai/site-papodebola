<?php
/**
 * SEO v2 - Uses correct Rank Math meta keys and fixes featured images
 */

$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
echo count($posts) . " posts to optimize\n\n";

$fixed = 0;

foreach ($posts as $post) {
    $title = $post->post_title;
    $content = strip_tags($post->post_content);
    $slug = $post->post_name;

    // 1. FOCUS KEYWORD - extract from title
    $stop_words = array('para','com','que','por','mais','após','como','sobre','entre','pela','este','esse','esta','essa','seus','suas','dele','dela','não','uma','dos','das','nos','nas');
    $words = array_filter(explode(' ', mb_strtolower($title)), function($w) use ($stop_words) {
        return mb_strlen($w) > 3 && !in_array($w, $stop_words);
    });
    $focus_kw = implode(' ', array_slice(array_values($words), 0, 4));

    // 2. META DESCRIPTION - first 155 chars of content
    $desc = wp_trim_words($content, 25, '');
    if (strlen($desc) > 155) $desc = substr($desc, 0, 152) . '...';

    // 3. Save Rank Math meta (correct keys)
    update_post_meta($post->ID, 'rank_math_focus_keyword', $focus_kw);
    update_post_meta($post->ID, 'rank_math_description', $desc);
    update_post_meta($post->ID, 'rank_math_title', '%title% - Papo de Bola');
    update_post_meta($post->ID, 'rank_math_robots', array('index'));
    update_post_meta($post->ID, 'rank_math_advanced_robots', array(
        'max-snippet' => '-1',
        'max-video-preview' => '-1',
        'max-image-preview' => 'large',
    ));

    // 4. Open Graph
    update_post_meta($post->ID, 'rank_math_facebook_title', $title . ' - Papo de Bola');
    update_post_meta($post->ID, 'rank_math_facebook_description', $desc);
    update_post_meta($post->ID, 'rank_math_twitter_use_facebook', 'on');

    // 5. Schema - correct format for Rank Math
    $schema_data = array(
        'metadata' => array(
            'title' => 'NewsArticle',
            'type' => 'template',
            'shortcode' => 'a' . $post->ID,
            'isPrimary' => true,
        ),
        '@type' => 'NewsArticle',
        'headline' => '%seo_title%',
        'description' => '%seo_description%',
        'datePublished' => '%date(Y-m-dTH:i:sP)%',
        'dateModified' => '%modified(Y-m-dTH:i:sP)%',
        'author' => array(
            '@type' => 'Organization',
            'name' => 'Papo de Bola',
        ),
        'publisher' => array(
            '@type' => 'Organization',
            'name' => 'Papo de Bola',
            'logo' => array(
                '@type' => 'ImageObject',
                'url' => 'https://papodebola.com.br/favicon.svg',
            ),
        ),
        'mainEntityOfPage' => array(
            '@type' => 'WebPage',
            '@id' => '%url%',
        ),
        'image' => array(
            '@type' => 'ImageObject',
            'url' => '%post_thumbnail%',
        ),
    );
    update_post_meta($post->ID, 'rank_math_rich_snippet', 'article');
    update_post_meta($post->ID, 'rank_math_snippet_article_type', 'NewsArticle');
    update_post_meta($post->ID, 'rank_math_snippet_name', '%seo_title%');
    update_post_meta($post->ID, 'rank_math_snippet_desc', '%seo_description%');

    // 6. FIX FEATURED IMAGE - find media by slug match
    if (!has_post_thumbnail($post->ID)) {
        $media = get_posts(array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'name' => $slug,
            'numberposts' => 1,
        ));

        if (empty($media)) {
            // Try partial slug match
            $media = get_posts(array(
                'post_type' => 'attachment',
                'post_status' => 'inherit',
                's' => substr($slug, 0, 30),
                'numberposts' => 1,
            ));
        }

        if (!empty($media)) {
            set_post_thumbnail($post->ID, $media[0]->ID);
            echo "  [IMG] Set thumbnail #{$media[0]->ID} for post #{$post->ID}\n";
        } else {
            echo "  [IMG] No media found for: {$slug}\n";
        }
    }

    // 7. SET EXCERPT if empty
    if (empty($post->post_excerpt)) {
        $excerpt = wp_trim_words($content, 30, '...');
        wp_update_post(array('ID' => $post->ID, 'post_excerpt' => $excerpt));
    }

    $fixed++;
    echo "  #{$post->ID} [KW: {$focus_kw}] | " . substr($title, 0, 50) . "\n";
}

echo "\n=== {$fixed} posts optimized ===\n";

// Verify
echo "\n--- Verification ---\n";
$sample = get_posts(array('numberposts' => 3, 'post_status' => 'publish'));
foreach ($sample as $p) {
    echo "Post #{$p->ID}: " . substr($p->post_title, 0, 40) . "\n";
    echo "  Focus KW: " . get_post_meta($p->ID, 'rank_math_focus_keyword', true) . "\n";
    echo "  Meta Desc: " . substr(get_post_meta($p->ID, 'rank_math_description', true), 0, 60) . "...\n";
    echo "  Schema: " . get_post_meta($p->ID, 'rank_math_rich_snippet', true) . " / " . get_post_meta($p->ID, 'rank_math_snippet_article_type', true) . "\n";
    echo "  Thumbnail: " . (has_post_thumbnail($p->ID) ? 'YES #' . get_post_thumbnail_id($p->ID) : 'NO') . "\n\n";
}

// Flush
flush_rewrite_rules();
echo "Done!\n";
