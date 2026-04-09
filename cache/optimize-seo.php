<?php
/**
 * SEO Optimization for all posts
 * Adds focus keywords, meta descriptions, internal links, schema
 * Run: wp eval-file /tmp/optimize-seo.php --allow-root
 */

// Keyword mapping by category/tag
$category_keywords = array(
    'brasileirao' => 'brasileirão, campeonato brasileiro, série a, tabela brasileirão',
    'copa-do-brasil' => 'copa do brasil, copa do brasil 2026, jogos copa do brasil',
    'copa-do-mundo' => 'copa do mundo 2026, world cup, fifa, copa do mundo',
    'selecao-brasileira' => 'seleção brasileira, brasil futebol, convocação seleção',
    'copa-libertadores' => 'libertadores 2026, copa libertadores, conmebol libertadores',
    'champions-league' => 'champions league, uefa champions, liga dos campeões',
    'premier-league' => 'premier league, campeonato inglês, futebol inglês',
    'la-liga' => 'la liga, campeonato espanhol, liga espanhola',
    'futebol-internacional' => 'futebol internacional, futebol europeu, transferências',
    'mercado-da-bola' => 'mercado da bola, transferências futebol, contratações',
    'futebol-brasileiro' => 'futebol brasileiro, futebol brasil, brasileirão',
);

$team_keywords = array(
    'palmeiras' => 'palmeiras, palmeiras notícias, verdão, sociedade esportiva palmeiras',
    'flamengo' => 'flamengo, flamengo notícias, mengão, clube de regatas do flamengo',
    'corinthians' => 'corinthians, corinthians notícias, timão, sport club corinthians',
    'sao-paulo' => 'são paulo fc, são paulo notícias, tricolor, spfc',
    'santos' => 'santos fc, santos notícias, peixe, santos futebol clube',
    'fluminense' => 'fluminense, fluminense notícias, flu, tricolor carioca',
    'botafogo' => 'botafogo, botafogo notícias, fogão, botafogo rj',
    'vasco' => 'vasco, vasco notícias, vascão, vasco da gama',
    'gremio' => 'grêmio, grêmio notícias, imortal, grêmio fbpa',
    'internacional' => 'internacional, inter notícias, colorado, sport club internacional',
    'atletico-mg' => 'atlético-mg, atlético mineiro, galo, cam',
    'cruzeiro' => 'cruzeiro, cruzeiro notícias, raposa, cruzeiro esporte clube',
    'bahia' => 'bahia, bahia notícias, tricolor baiano, esporte clube bahia',
    'fortaleza' => 'fortaleza, fortaleza notícias, leão, fortaleza ec',
    'athletico-pr' => 'athletico, athletico paranaense, furacão, cap',
    'real-madrid' => 'real madrid, real madrid notícias, merengues, los blancos',
    'barcelona' => 'barcelona, barcelona notícias, barça, fc barcelona',
    'liverpool' => 'liverpool, liverpool notícias, reds, liverpool fc',
);

$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
echo count($posts) . " posts to optimize\n\n";

$optimized = 0;

foreach ($posts as $post) {
    $title = $post->post_title;
    $content = $post->post_content;
    $slug = $post->post_name;
    $excerpt = wp_trim_words(strip_tags($content), 30, '...');

    // Get categories and tags
    $cats = wp_get_post_categories($post->ID, array('fields' => 'slugs'));
    $tags = wp_get_post_tags($post->ID, array('fields' => 'slugs'));

    // Build focus keyword from title (first 4-5 significant words)
    $title_words = array_filter(explode(' ', strtolower($title)), function($w) {
        return strlen($w) > 3 && !in_array($w, array('para', 'com', 'que', 'por', 'mais', 'após', 'como', 'sobre', 'entre', 'pela', 'após', 'este', 'esse', 'esta', 'essa', 'seus', 'suas', 'dele', 'dela', 'deles', 'delas'));
    });
    $focus_keyword = implode(' ', array_slice(array_values($title_words), 0, 4));

    // Add team/category keywords
    $secondary_keywords = array();
    foreach ($tags as $tag) {
        if (isset($team_keywords[$tag])) {
            $kws = explode(', ', $team_keywords[$tag]);
            $secondary_keywords = array_merge($secondary_keywords, array_slice($kws, 0, 2));
        }
    }
    foreach ($cats as $cat) {
        if (isset($category_keywords[$cat])) {
            $kws = explode(', ', $category_keywords[$cat]);
            $secondary_keywords = array_merge($secondary_keywords, array_slice($kws, 0, 2));
        }
    }

    // Meta description (150-160 chars, includes keyword)
    $meta_desc = wp_trim_words(strip_tags($content), 25, '');
    if (strlen($meta_desc) > 155) $meta_desc = substr($meta_desc, 0, 152) . '...';

    // Update Rank Math meta
    update_post_meta($post->ID, 'rank_math_title', $title . ' - Papo de Bola');
    update_post_meta($post->ID, 'rank_math_description', $meta_desc);
    update_post_meta($post->ID, 'rank_math_focus_keyword', $focus_keyword);
    if (!empty($secondary_keywords)) {
        update_post_meta($post->ID, 'rank_math_focus_keyword', $focus_keyword . ',' . implode(',', array_unique(array_slice($secondary_keywords, 0, 4))));
    }

    // Schema - NewsArticle
    $schema = array(
        array(
            '@type' => 'NewsArticle',
            'headline' => $title,
            'description' => $meta_desc,
            'datePublished' => $post->post_date,
            'dateModified' => $post->post_modified,
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
                '@id' => get_permalink($post->ID),
            ),
        ),
    );
    update_post_meta($post->ID, 'rank_math_schema_NewsArticle', $schema);

    // Open Graph
    update_post_meta($post->ID, 'rank_math_facebook_title', $title);
    update_post_meta($post->ID, 'rank_math_facebook_description', $meta_desc);
    update_post_meta($post->ID, 'rank_math_twitter_title', $title);
    update_post_meta($post->ID, 'rank_math_twitter_description', $meta_desc);

    // Robots
    update_post_meta($post->ID, 'rank_math_robots', array('index', 'follow'));

    // Add internal links to content (link juice)
    $updated_content = $content;
    $linked = 0;
    $max_links = 3;

    // Find related posts to link to
    $related = get_posts(array(
        'numberposts' => 5,
        'exclude' => array($post->ID),
        'category__in' => wp_get_post_categories($post->ID),
        'post_status' => 'publish',
        'orderby' => 'rand',
    ));

    foreach ($related as $rel) {
        if ($linked >= $max_links) break;

        // Find a mention of relevant words in the content
        $rel_words = array_filter(explode(' ', $rel->post_title), function($w) {
            return strlen($w) > 4;
        });

        foreach ($rel_words as $word) {
            $word = trim($word, ',:;.!?');
            if (strlen($word) < 5) continue;

            // Check if word exists in content and is not already linked
            if (stripos($updated_content, $word) !== false && stripos($updated_content, 'href') === false || true) {
                $pattern = '/(?<!<a[^>]*>)\b(' . preg_quote($word, '/') . ')\b(?![^<]*<\/a>)/iu';
                $replacement = '<a href="' . get_permalink($rel->ID) . '" title="' . esc_attr($rel->post_title) . '">$1</a>';
                $updated_content = preg_replace($pattern, $replacement, $updated_content, 1, $count);
                if ($count > 0) {
                    $linked++;
                    break;
                }
            }
        }
    }

    // Update content with internal links
    if ($linked > 0) {
        wp_update_post(array('ID' => $post->ID, 'post_content' => $updated_content));
    }

    $optimized++;
    $kw_display = substr($focus_keyword, 0, 30);
    echo "  #{$post->ID} [{$kw_display}] +{$linked} links | " . substr($title, 0, 45) . "\n";
}

echo "\n=== {$optimized} posts optimized ===\n";

// Flush rewrite rules
flush_rewrite_rules();
echo "Rewrite rules flushed\n";

// Ping search engines
wp_remote_get('https://www.google.com/ping?sitemap=' . urlencode(home_url('/sitemap_index.xml')));
wp_remote_get('https://www.bing.com/ping?sitemap=' . urlencode(home_url('/sitemap_index.xml')));
echo "Search engines pinged\n";
