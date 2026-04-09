<?php
/**
 * SEO v4 - Fix ALL Rank Math criteria for 80+ score
 *
 * Fixes: keyword density, headings, meta desc with KW,
 * SEO title length, internal links, external links, KW in intro
 */

$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
echo count($posts) . " posts to optimize\n\n";

// Get all posts for internal linking
$all_posts = $posts;

$fixed = 0;

foreach ($posts as $post) {
    $id = $post->ID;
    $title = $post->post_title;
    $content = $post->post_content;
    $slug = $post->post_name;
    $content_text = strip_tags($content);

    // Get current focus keyword
    $kw_raw = get_post_meta($id, 'rank_math_focus_keyword', true);
    $kw_parts = explode(',', $kw_raw);
    $primary_kw = trim($kw_parts[0]);

    if (empty($primary_kw) || mb_strlen($primary_kw) < 3) {
        // Generate from title - take first 3 significant words
        $stop = array('para','com','que','por','mais','como','sobre','entre','pela','uma','dos','das','nos','nas','mas','pode','tem','vai','sem','foi','ainda','após');
        $words = array_filter(explode(' ', mb_strtolower($title)), function($w) use ($stop) {
            return mb_strlen($w) > 2 && !in_array($w, $stop);
        });
        $primary_kw = implode(' ', array_slice(array_values($words), 0, 3));
    }

    // Use shorter keyword (3 words max) for better matching
    $kw_words = explode(' ', $primary_kw);
    if (count($kw_words) > 3) {
        $primary_kw = implode(' ', array_slice($kw_words, 0, 3));
    }

    $changes = array();

    // === 1. SEO TITLE: max 60 chars, KW at start ===
    $seo_title = $title;
    if (mb_strlen($seo_title) > 55) {
        $seo_title = mb_substr($seo_title, 0, 52) . '...';
    }
    $seo_title .= ' | Papo de Bola';
    if (mb_strlen($seo_title) > 60) {
        $seo_title = mb_substr($title, 0, 45) . ' | Papo de Bola';
    }
    update_post_meta($id, 'rank_math_title', $seo_title);

    // === 2. META DESCRIPTION: 120-155 chars, with KW ===
    $desc = ucfirst($primary_kw) . ': ' . wp_trim_words($content_text, 18, '');
    if (mb_strlen($desc) > 140) {
        $desc = mb_substr($desc, 0, 137);
    }
    $desc .= '. Leia mais!';
    if (mb_strlen($desc) > 155) {
        $desc = mb_substr($desc, 0, 142) . '. Leia mais!';
    }
    update_post_meta($id, 'rank_math_description', $desc);

    // === 3. ADD HEADINGS to content (convert bold subtitles to H2) ===
    $new_content = $content;

    // Convert <strong>ALL CAPS TEXT</strong> to <h2>
    $new_content = preg_replace(
        '/<p>\s*<strong>([A-ZÁÉÍÓÚÂÊÔÃÕÇÜ][A-ZÁÉÍÓÚÂÊÔÃÕÇÜ\s,]{4,})<\/strong>\s*[—–-]\s*/u',
        '<h2>$1</h2><p>',
        $new_content
    );

    // If no H2 found, add a keyword-based H2 after first paragraph
    if (stripos($new_content, '<h2') === false) {
        $h2_title = ucfirst($primary_kw);
        $new_content = preg_replace('/<\/p>/', '</p><h2>' . $h2_title . '</h2>', $new_content, 1);
        $changes[] = '+H2';
    }

    // === 4. ADD KW TO FIRST PARAGRAPH (intro) ===
    $kw_lower = mb_strtolower($primary_kw);
    $content_lower = mb_strtolower($new_content);

    if (mb_strpos(mb_substr($content_lower, 0, 500), $kw_lower) === false) {
        // Insert KW naturally in first paragraph
        $new_content = preg_replace('/<p>/', '<p>' . ucfirst($primary_kw) . ' — ', $new_content, 1);
        $changes[] = '+KW intro';
    }

    // === 5. KW DENSITY: add KW 2-3 more times if density < 0.5% ===
    $kw_count = mb_substr_count(mb_strtolower(strip_tags($new_content)), $kw_lower);
    $word_count = str_word_count(strip_tags($new_content));
    $density = $word_count > 0 ? ($kw_count / $word_count) * 100 : 0;

    if ($density < 0.5 && $kw_count < 3) {
        // Add KW in a mid-paragraph naturally
        $paragraphs = explode('</p>', $new_content);
        $mid = intval(count($paragraphs) / 2);
        if (isset($paragraphs[$mid])) {
            $paragraphs[$mid] .= ' ' . ucfirst($primary_kw) . ' continua sendo destaque.';
            $changes[] = '+KW density';
        }
        $new_content = implode('</p>', $paragraphs);
    }

    // === 6. INTERNAL LINKS: add 2-3 ===
    $internal_count = preg_match_all('/href="https?:\/\/admin\.papodebola/', $new_content);
    if ($internal_count < 2) {
        // Find related posts
        $my_cats = wp_get_post_categories($id);
        $related = get_posts(array(
            'numberposts' => 3,
            'exclude' => array($id),
            'category__in' => $my_cats,
            'post_status' => 'publish',
        ));

        $links_added = 0;
        foreach ($related as $rel) {
            if ($links_added >= 2) break;
            $link = get_permalink($rel->ID);
            $anchor = wp_trim_words($rel->post_title, 5, '');
            // Add as "Leia também" link at end of a paragraph
            $new_content = preg_replace(
                '/<\/p>/',
                '. <a href="' . $link . '">' . $anchor . '</a></p>',
                $new_content,
                1
            );
            $links_added++;
        }
        if ($links_added > 0) $changes[] = "+{$links_added} links";
    }

    // === 7. EXTERNAL LINK: add 1 authoritative source ===
    $ext_count = preg_match_all('/href="https?:\/\/(?!admin\.papodebola)/', $new_content);
    if ($ext_count < 1) {
        // Add a relevant external link
        $ext_links = array(
            'brasileirão' => array('https://www.cbf.com.br/', 'CBF'),
            'copa libertadores' => array('https://www.conmebol.com/', 'CONMEBOL'),
            'champions league' => array('https://www.uefa.com/', 'UEFA'),
            'premier league' => array('https://www.premierleague.com/', 'Premier League'),
            'copa do mundo' => array('https://www.fifa.com/', 'FIFA'),
            'futebol internacional' => array('https://www.uefa.com/', 'UEFA'),
        );

        $cats = wp_get_post_categories($id, array('fields' => 'slugs'));
        $ext = null;
        foreach ($cats as $cat) {
            $cat_clean = str_replace('-', ' ', $cat);
            if (isset($ext_links[$cat_clean])) { $ext = $ext_links[$cat_clean]; break; }
        }
        if (!$ext) $ext = array('https://www.cbf.com.br/', 'CBF');

        $new_content .= '<p><em>Fonte oficial: <a href="' . $ext[0] . '" target="_blank" rel="nofollow noopener">' . $ext[1] . '</a></em></p>';
        $changes[] = '+ext link';
    }

    // === 8. UPDATE CONTENT ===
    if ($new_content !== $content) {
        wp_update_post(array('ID' => $id, 'post_content' => $new_content));
    }

    // === 9. UPDATE FOCUS KEYWORD (shorter, 3 words) ===
    $secondary = array_slice($kw_parts, 1, 4);
    $all_kw = $primary_kw;
    if (!empty($secondary)) {
        $all_kw .= ',' . implode(',', array_map('trim', $secondary));
    }
    update_post_meta($id, 'rank_math_focus_keyword', $all_kw);

    // === 10. SCHEMA ===
    update_post_meta($id, 'rank_math_rich_snippet', 'article');
    update_post_meta($id, 'rank_math_snippet_article_type', 'NewsArticle');

    $fixed++;
    $changes_str = implode(', ', $changes);
    echo "  #{$id} [KW: {$primary_kw}] {$changes_str} | " . mb_substr($title, 0, 45) . "\n";
}

echo "\n=== {$fixed} posts optimized ===\n";
flush_rewrite_rules();
wp_remote_get('https://www.google.com/ping?sitemap=' . urlencode(home_url('/sitemap_index.xml')));
echo "Done!\n";
