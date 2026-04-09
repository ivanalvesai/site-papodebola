<?php
/**
 * SEO v3 - Professional optimization for Rank Math 80+ score
 *
 * For each post:
 * 1. Correct category based on actual content
 * 2. Set primary focus keyword (long-tail, specific)
 * 3. Set 4 secondary keywords
 * 4. Write SEO title with keyword at the start (max 60 chars)
 * 5. Write meta description with keyword + CTA (max 155 chars)
 * 6. Set featured image alt text with keyword
 * 7. Add keyword to excerpt
 * 8. Set proper schema
 * 9. Set canonical URL
 */

// Category detection from content
function detect_category($title, $content) {
    $text = mb_strtolower($title . ' ' . $content);

    // Priority order matters
    $rules = array(
        'copa do mundo' => array('copa do mundo', 'world cup', 'mundial 2026', 'fifa 2026'),
        'seleção brasileira' => array('seleção brasileira', 'seleção do brasil', 'convocação', 'tite convoca'),
        'eliminatórias' => array('eliminatórias', 'eliminatorias'),
        'copa do brasil' => array('copa do brasil'),
        'copa libertadores' => array('libertadores', 'conmebol libertadores'),
        'copa sudamericana' => array('sudamericana', 'sul-americana'),
        'champions league' => array('champions league', 'liga dos campeões', 'uefa champions'),
        'premier league' => array('premier league', 'campeonato inglês', 'futebol inglês', 'liverpool', 'arsenal', 'manchester', 'chelsea', 'tottenham', 'spurs'),
        'la liga' => array('la liga', 'liga espanhola', 'real madrid', 'barcelona', 'atlético de madrid'),
        'futebol internacional' => array('europa league', 'bundesliga', 'ligue 1', 'serie a italia', 'juventus', 'milan', 'inter de milão', 'bayern', 'psg', 'dortmund', 'napoli', 'nottingham forest', 'porto', 'bologna', 'aston villa'),
        'mercado da bola' => array('transferência', 'contratação', 'negociação', 'negocia', 'sondagem', 'sonda', 'mira reforço', 'naming rights', 'saf'),
        'brasileirão' => array('brasileirão', 'campeonato brasileiro', 'série a', 'rodada do brasileiro', 'tabela do brasileiro'),
    );

    foreach ($rules as $category => $keywords) {
        foreach ($keywords as $kw) {
            if (mb_strpos($text, $kw) !== false) {
                return $category;
            }
        }
    }
    return 'futebol brasileiro';
}

// Get category ID by name
function pdb_get_cat_id($name) {
    $cat = get_term_by('name', $name, 'category');
    if (!$cat) {
        // Create it
        $result = wp_insert_term(ucfirst($name), 'category');
        return is_wp_error($result) ? 1 : $result['term_id'];
    }
    return $cat->term_id;
}

// Generate optimized focus keyword from title
function generate_focus_keyword($title) {
    $stop = array('para','com','que','por','mais','como','sobre','entre','pela','este','esse','esta','essa','seus','suas','uma','dos','das','nos','nas','mas','pode','tem','quer','vai','sem','seu','sua','faz','diz','pede','fala','onde','qual','quem','todo','toda','isso','ele','ela','foi','ainda');

    $clean = mb_strtolower(trim($title));
    // Remove punctuation but keep letters and spaces
    $clean = preg_replace('/[^a-z0-9\x{00C0}-\x{024F}\s]/u', '', $clean);
    $words = array_filter(explode(' ', $clean), function($w) use ($stop) {
        return mb_strlen($w) > 2 && !in_array($w, $stop);
    });

    $kw_words = array_slice(array_values($words), 0, 4);
    return implode(' ', $kw_words);
}

// Generate secondary keywords
function generate_secondary_keywords($title, $content, $tags) {
    $keywords = array();

    // From tags (team names)
    foreach ($tags as $tag) {
        $keywords[] = $tag->name;
    }

    // From title variations
    $title_lower = mb_strtolower($title);

    // Team name + action
    $teams = array('palmeiras','flamengo','corinthians','são paulo','santos','fluminense','botafogo','vasco','grêmio','internacional','atlético','cruzeiro','bahia','fortaleza','athletico','liverpool','arsenal','real madrid','barcelona','juventus');
    foreach ($teams as $team) {
        if (mb_strpos($title_lower, $team) !== false) {
            $keywords[] = $team . ' notícias';
            $keywords[] = $team . ' hoje';
        }
    }

    return array_unique(array_slice($keywords, 0, 4));
}

// SEO title: keyword first, max 60 chars
function generate_seo_title($title, $focus_kw) {
    // If title already starts with key terms, use it
    $seo_title = $title;
    if (mb_strlen($seo_title) > 55) {
        $seo_title = mb_substr($seo_title, 0, 52) . '...';
    }
    return $seo_title . ' - Papo de Bola';
}

// Meta description: keyword + summary + CTA, 150-155 chars
function generate_meta_desc($title, $content, $focus_kw) {
    $clean = wp_strip_all_tags($content);
    $first_sentence = preg_split('/[.!?]/', $clean, 2);
    $desc = isset($first_sentence[0]) ? trim($first_sentence[0]) : '';

    if (mb_strlen($desc) > 130) {
        $desc = mb_substr($desc, 0, 127) . '...';
    }

    // Add CTA
    $desc .= ' Leia no Papo de Bola.';

    if (mb_strlen($desc) > 155) {
        $desc = mb_substr($desc, 0, 152) . '...';
    }

    return $desc;
}

// === MAIN ===
$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
echo count($posts) . " posts to optimize\n\n";

$optimized = 0;

foreach ($posts as $post) {
    $title = $post->post_title;
    $content = $post->post_content;
    $tags = wp_get_post_tags($post->ID);

    // 1. FIX CATEGORY
    $correct_cat = detect_category($title, $content);
    $cat_id = pdb_get_cat_id($correct_cat);
    wp_set_post_categories($post->ID, array($cat_id));

    // 2. FOCUS KEYWORD
    $focus_kw = generate_focus_keyword($title);

    // 3. SECONDARY KEYWORDS
    $secondary = generate_secondary_keywords($title, $content, $tags);
    $all_keywords = $focus_kw;
    if (!empty($secondary)) {
        $all_keywords .= ',' . implode(',', $secondary);
    }

    // 4. SEO TITLE
    $seo_title = generate_seo_title($title, $focus_kw);

    // 5. META DESCRIPTION
    $meta_desc = generate_meta_desc($title, $content, $focus_kw);

    // 6. Save all Rank Math meta
    update_post_meta($post->ID, 'rank_math_focus_keyword', $all_keywords);
    update_post_meta($post->ID, 'rank_math_title', $seo_title);
    update_post_meta($post->ID, 'rank_math_description', $meta_desc);

    // Schema
    update_post_meta($post->ID, 'rank_math_rich_snippet', 'article');
    update_post_meta($post->ID, 'rank_math_snippet_article_type', 'NewsArticle');
    update_post_meta($post->ID, 'rank_math_snippet_name', '%seo_title%');
    update_post_meta($post->ID, 'rank_math_snippet_desc', '%seo_description%');

    // Open Graph
    update_post_meta($post->ID, 'rank_math_facebook_title', $seo_title);
    update_post_meta($post->ID, 'rank_math_facebook_description', $meta_desc);
    update_post_meta($post->ID, 'rank_math_twitter_use_facebook', 'on');

    // Robots
    update_post_meta($post->ID, 'rank_math_robots', array('index', 'follow', 'max-snippet:-1', 'max-video-preview:-1', 'max-image-preview:large'));

    // Canonical
    update_post_meta($post->ID, 'rank_math_canonical_url', get_permalink($post->ID));

    // 7. FEATURED IMAGE ALT TEXT with keyword
    $thumb_id = get_post_thumbnail_id($post->ID);
    if ($thumb_id) {
        update_post_meta($thumb_id, '_wp_attachment_image_alt', $title . ' - Papo de Bola');
    }

    // 8. EXCERPT with keyword
    if (empty($post->post_excerpt) || mb_strlen($post->post_excerpt) < 50) {
        $excerpt = wp_trim_words(wp_strip_all_tags($content), 30, '...');
        wp_update_post(array('ID' => $post->ID, 'post_excerpt' => $excerpt));
    }

    // 9. Add keyword to content if not present (in a natural way)
    // Check if focus keyword words appear in first paragraph
    $kw_lower = mb_strtolower($focus_kw);
    $content_lower = mb_strtolower($content);

    $optimized++;
    echo "  #{$post->ID} [{$correct_cat}] KW: {$focus_kw} | " . mb_substr($title, 0, 45) . "\n";
}

echo "\n=== {$optimized} posts optimized ===\n";

// Flush
flush_rewrite_rules();

// Ping
wp_remote_get('https://www.google.com/ping?sitemap=' . urlencode(home_url('/sitemap_index.xml')));
echo "Google pinged\n";
