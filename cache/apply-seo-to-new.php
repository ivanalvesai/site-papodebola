<?php
/**
 * Apply SEO to posts that don't have focus keyword set.
 * Run after publishing new posts via REST API.
 * Usage: wp eval-file /tmp/apply-seo-to-new.php --allow-root
 */

$posts = get_posts(array(
    'numberposts' => 20,
    'post_status' => 'publish',
    'orderby' => 'date',
    'order' => 'DESC',
    'meta_query' => array(
        'relation' => 'OR',
        array('key' => 'rank_math_focus_keyword', 'compare' => 'NOT EXISTS'),
        array('key' => 'rank_math_focus_keyword', 'value' => '', 'compare' => '='),
    ),
));

echo count($posts) . " posts without SEO\n";

$stop = array('para','com','que','por','mais','como','sobre','entre','pela','uma','dos','das','nos','nas','mas','pode','tem','vai','sem','foi','ainda','após','não','são','está');

function detect_cat($title, $content) {
    $t = mb_strtolower($title);
    $rules = array(
        'Futebol Internacional' => array('europa league','liga europa','conference league'),
        'Champions League' => array('champions league','champions'),
        'Copa Libertadores' => array('libertadores'),
        'Copa Sudamericana' => array('sudamericana','sul-americana'),
        'Copa do Brasil' => array('copa do brasil'),
        'Copa do Mundo' => array('copa do mundo','world cup','mundial'),
        'Seleção Brasileira' => array('seleção brasileira','seleção'),
        'Premier League' => array('premier league','liverpool','arsenal','manchester','chelsea','tottenham','spurs'),
        'La Liga' => array('la liga','real madrid','barcelona','atlético de madrid'),
        'Brasileirão' => array('brasileirão','campeonato brasileiro','série a'),
        'Mercado da Bola' => array('negocia','transferência','contratação','sondagem','naming rights','saf','rescisão'),
    );
    $text = mb_strtolower($title . ' ' . wp_trim_words(strip_tags($content), 100));
    foreach ($rules as $cat => $kws) {
        foreach ($kws as $kw) {
            if (mb_strpos($t, $kw) !== false) return $cat;
        }
    }
    foreach ($rules as $cat => $kws) {
        foreach ($kws as $kw) {
            if (mb_strpos($text, $kw) !== false) return $cat;
        }
    }
    $intl = array('liverpool','arsenal','manchester','chelsea','tottenham','real madrid','barcelona','juventus','milan','bayern','psg','dortmund','napoli','nottingham','porto','bologna','aston villa');
    foreach ($intl as $team) {
        if (mb_strpos($t, $team) !== false) return 'Futebol Internacional';
    }
    return 'Futebol Brasileiro';
}

foreach ($posts as $post) {
    $title = $post->post_title;
    $content = $post->post_content;
    $text = strip_tags($content);

    // Focus keyword
    $words = array_filter(explode(' ', mb_strtolower(preg_replace('/[^\w\sáéíóúâêôãõçü-]/u', '', $title))), function($w) use ($stop) {
        return mb_strlen($w) > 2 && !in_array($w, $stop);
    });
    $focus_kw = implode(' ', array_slice(array_values($words), 0, 3));

    // SEO title
    $seo_title = mb_strlen($title) > 50 ? mb_substr($title, 0, 47) . '...' : $title;
    $seo_title .= ' | Papo de Bola';
    if (mb_strlen($seo_title) > 60) $seo_title = mb_substr($title, 0, 42) . ' | Papo de Bola';

    // Meta desc
    $first = preg_split('/[.!?]/', $text, 2);
    $desc = ucfirst($focus_kw) . ': ' . mb_substr(trim($first[0] ?? ''), 0, 110);
    $desc .= '. Leia mais!';
    if (mb_strlen($desc) > 155) $desc = mb_substr($desc, 0, 142) . '. Leia mais!';

    // Category
    $cat_name = detect_cat($title, $content);
    $cat = get_term_by('name', $cat_name, 'category');
    if ($cat) wp_set_post_categories($post->ID, array($cat->term_id));

    // Tags from content
    $tags = wp_get_post_tags($post->ID);
    $secondary = array_slice(array_map(function($t) { return $t->name; }, $tags), 0, 3);
    $all_kw = $focus_kw . (!empty($secondary) ? ',' . implode(',', $secondary) : '');

    // Save Rank Math meta
    update_post_meta($post->ID, 'rank_math_focus_keyword', $all_kw);
    update_post_meta($post->ID, 'rank_math_title', $seo_title);
    update_post_meta($post->ID, 'rank_math_description', $desc);
    update_post_meta($post->ID, 'rank_math_rich_snippet', 'article');
    update_post_meta($post->ID, 'rank_math_snippet_article_type', 'NewsArticle');
    update_post_meta($post->ID, 'rank_math_robots', array('index', 'follow', 'max-snippet:-1', 'max-image-preview:large'));
    update_post_meta($post->ID, 'rank_math_facebook_title', $seo_title);
    update_post_meta($post->ID, 'rank_math_facebook_description', $desc);
    update_post_meta($post->ID, 'rank_math_twitter_use_facebook', 'on');
    update_post_meta($post->ID, 'rank_math_canonical_url', 'https://papodebola.com.br/artigos/' . $post->post_name . '.html');

    // Alt text on featured image
    $thumb_id = get_post_thumbnail_id($post->ID);
    if ($thumb_id) {
        update_post_meta($thumb_id, '_wp_attachment_image_alt', $title . ' - Papo de Bola');
    }

    // Excerpt
    if (empty($post->post_excerpt)) {
        wp_update_post(array('ID' => $post->ID, 'post_excerpt' => wp_trim_words($text, 30, '...')));
    }

    echo "  #{$post->ID} [{$cat_name}] KW: {$focus_kw} | " . mb_substr($title, 0, 45) . "\n";
}

echo "\nDone!\n";
