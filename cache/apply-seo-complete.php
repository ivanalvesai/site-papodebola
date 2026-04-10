<?php
/**
 * Complete SEO optimization for new posts - Rank Math 80+ score
 * Applies ALL optimizations: keyword, meta, headings, TOC, density,
 * internal links, external links, short slug, schema, canonical, alt text
 *
 * Runs every 30 min via cron on posts missing focus keyword
 */

// === STOP WORDS ===
$stop_words = array('para','com','que','por','mais','como','sobre','entre','pela','uma','dos','das','nos','nas','mas','pode','tem','vai','sem','foi','ainda','após','não','são','está','seu','sua','ele','ela');

// === CATEGORY DETECTION ===
function pdb_detect_category($title, $content) {
    $t = mb_strtolower($title);
    $text = mb_strtolower($title . ' ' . wp_trim_words(strip_tags($content), 100));

    // Title first (more reliable)
    $title_rules = array(
        'Futebol Internacional' => array('europa league','liga europa','conference league'),
        'Champions League' => array('champions league','champions'),
        'Copa Libertadores' => array('libertadores'),
        'Copa Sudamericana' => array('sudamericana','sul-americana'),
        'Copa do Brasil' => array('copa do brasil'),
        'Copa do Mundo' => array('copa do mundo','world cup','mundial'),
        'Seleção Brasileira' => array('seleção brasileira','seleção'),
        'Brasileirão' => array('brasileirão','campeonato brasileiro','série a'),
    );
    foreach ($title_rules as $cat => $kws) {
        foreach ($kws as $kw) {
            if (mb_strpos($t, $kw) !== false) return $cat;
        }
    }

    // Full text
    $text_rules = array(
        'Futebol Internacional' => array('europa league','bundesliga','ligue 1','nottingham forest','bologna','aston villa'),
        'Premier League' => array('premier league','campeonato inglês'),
        'La Liga' => array('la liga','liga espanhola'),
        'Champions League' => array('champions league'),
        'Copa Libertadores' => array('libertadores'),
        'Copa do Mundo' => array('copa do mundo','world cup'),
        'Mercado da Bola' => array('negocia','transferência','contratação','sondagem','naming rights','saf','rescisão'),
        'Brasileirão' => array('brasileirão','série a','rodada do'),
    );
    foreach ($text_rules as $cat => $kws) {
        foreach ($kws as $kw) {
            if (mb_strpos($text, $kw) !== false) return $cat;
        }
    }

    // By team name
    $intl = array('liverpool','arsenal','manchester','chelsea','tottenham','real madrid','barcelona','juventus','milan','inter de milão','bayern','psg','dortmund','napoli','porto','nottingham');
    $br = array('palmeiras','flamengo','corinthians','são paulo','santos','fluminense','botafogo','vasco','grêmio','internacional','atlético','cruzeiro','bahia','fortaleza','athletico');
    foreach ($intl as $team) { if (mb_strpos($t, $team) !== false) return 'Futebol Internacional'; }
    foreach ($br as $team) { if (mb_strpos($t, $team) !== false) return 'Brasileirão'; }

    return 'Futebol Brasileiro';
}

// === FIND POSTS WITHOUT SEO ===
$posts = get_posts(array(
    'numberposts' => 30,
    'post_status' => 'publish',
    'orderby' => 'date',
    'order' => 'DESC',
    'meta_query' => array(
        'relation' => 'OR',
        array('key' => 'rank_math_focus_keyword', 'compare' => 'NOT EXISTS'),
        array('key' => 'rank_math_focus_keyword', 'value' => '', 'compare' => '='),
    ),
));

if (empty($posts)) {
    echo "All posts have SEO. Nothing to do.\n";
    exit;
}

echo count($posts) . " posts to optimize\n\n";

// External links by category
$ext_links = array(
    'Brasileirão' => array('https://www.cbf.com.br/', 'CBF'),
    'Copa Libertadores' => array('https://www.conmebol.com/', 'CONMEBOL'),
    'Champions League' => array('https://www.uefa.com/', 'UEFA'),
    'Premier League' => array('https://www.premierleague.com/', 'Premier League'),
    'Copa do Mundo' => array('https://www.fifa.com/', 'FIFA'),
    'Futebol Internacional' => array('https://www.uefa.com/', 'UEFA'),
    'Copa do Brasil' => array('https://www.cbf.com.br/', 'CBF'),
    'Copa Sudamericana' => array('https://www.conmebol.com/', 'CONMEBOL'),
    'Seleção Brasileira' => array('https://www.cbf.com.br/', 'CBF'),
    'La Liga' => array('https://www.laliga.com/', 'La Liga'),
    'Mercado da Bola' => array('https://www.cbf.com.br/', 'CBF'),
    'Futebol Brasileiro' => array('https://www.cbf.com.br/', 'CBF'),
);

global $stop_words;

foreach ($posts as $post) {
    $id = $post->ID;
    $title = $post->post_title;
    $content = $post->post_content;
    $slug = $post->post_name;
    $text = strip_tags($content);
    $changes = array();

    // === 1. CATEGORY ===
    $cat_name = pdb_detect_category($title, $content);
    $cat = get_term_by('name', $cat_name, 'category');
    if ($cat) wp_set_post_categories($id, array($cat->term_id));
    $changes[] = $cat_name;

    // === 2. FOCUS KEYWORD (3 words) ===
    $words = array_filter(explode(' ', mb_strtolower(preg_replace('/[^\w\sáéíóúâêôãõçü-]/u', '', $title))), function($w) use ($stop_words) {
        return mb_strlen($w) > 2 && !in_array($w, $stop_words);
    });
    $focus_kw = implode(' ', array_slice(array_values($words), 0, 3));

    // Secondary from tags
    $tags = wp_get_post_tags($id);
    $secondary = array_slice(array_map(function($t) { return $t->name; }, $tags), 0, 3);
    $all_kw = $focus_kw . (!empty($secondary) ? ',' . implode(',', $secondary) : '');

    // === 3. SEO TITLE < 60 chars ===
    $seo_title = mb_strlen($title) > 50 ? mb_substr($title, 0, 47) . '...' : $title;
    $seo_title .= ' | Papo de Bola';
    if (mb_strlen($seo_title) > 60) $seo_title = mb_substr($title, 0, 42) . ' | Papo de Bola';

    // === 4. META DESCRIPTION with KW + CTA ===
    $first_sentence = preg_split('/[.!?]/', $text, 2);
    $desc = ucfirst($focus_kw) . ': ' . mb_substr(trim($first_sentence[0] ?? ''), 0, 110);
    $desc .= '. Leia mais!';
    if (mb_strlen($desc) > 155) $desc = mb_substr($desc, 0, 142) . '. Leia mais!';

    // === 5. SHORTEN SLUG ===
    if (strlen($slug) > 55) {
        $new_slug = substr($slug, 0, 55);
        $last = strrpos($new_slug, '-');
        if ($last > 30) $new_slug = substr($new_slug, 0, $last);
        $slug = $new_slug;
        $changes[] = 'slug';
    }

    // === 6. CONTENT OPTIMIZATION ===
    $new_content = $content;
    $kw_lower = mb_strtolower($focus_kw);

    // 6a. Convert bold subtitles to H2
    $new_content = preg_replace(
        '/<p>\s*<strong>([A-ZÁÉÍÓÚÂÊÔÃÕÇÜ][A-ZÁÉÍÓÚÂÊÔÃÕÇÜ\s,]{4,})<\/strong>\s*[—–-]\s*/u',
        '<h2>$1</h2><p>',
        $new_content
    );

    // 6b. Add H2 if none exists
    if (stripos($new_content, '<h2') === false) {
        $h2 = ucfirst($focus_kw);
        $new_content = preg_replace('/<\/p>/', '</p><h2>' . $h2 . '</h2>', $new_content, 1);
        $changes[] = '+H2';
    }

    // 6c. Add KW to first paragraph
    if (mb_strpos(mb_strtolower(mb_substr($new_content, 0, 500)), $kw_lower) === false) {
        $new_content = preg_replace('/<p>/', '<p>' . ucfirst($focus_kw) . ' — ', $new_content, 1);
        $changes[] = '+KW intro';
    }

    // 6d. Boost KW density to ~1%
    $kw_count = mb_substr_count(mb_strtolower(strip_tags($new_content)), $kw_lower);
    $word_count = str_word_count(strip_tags($new_content));
    $target = max(5, intval($word_count * 0.01));

    if ($kw_count < $target) {
        $paragraphs = explode('</p>', $new_content);
        $added = 0;
        $needed = $target - $kw_count;
        $variations = array(
            ' Sobre ' . $focus_kw . ', vale acompanhar os próximos capítulos.',
            ' O cenário envolvendo ' . $focus_kw . ' segue em evolução.',
            ' A situação de ' . $focus_kw . ' merece atenção dos torcedores.',
        );
        $interval = max(1, intval(count($paragraphs) / ($needed + 1)));
        for ($i = 1; $i < count($paragraphs) && $added < $needed; $i += $interval) {
            if (isset($paragraphs[$i]) && mb_strlen(strip_tags($paragraphs[$i])) > 30) {
                $paragraphs[$i] .= $variations[$added % count($variations)];
                $added++;
            }
        }
        $new_content = implode('</p>', $paragraphs);
        $changes[] = "+{$added} KW";
    }

    // 6e. Add TOC if 3+ headings
    preg_match_all('/<h2[^>]*>(.*?)<\/h2>/i', $new_content, $headings);
    if (count($headings[1]) >= 3 && strpos($new_content, 'Neste artigo') === false) {
        $toc = '<div style="background:#f8f9fa;border:1px solid #e2e5e9;border-radius:8px;padding:16px 20px;margin:20px 0"><strong>Neste artigo:</strong><ul style="margin:8px 0 0;padding-left:20px">';
        foreach ($headings[1] as $i => $h) {
            $anchor = 'section-' . $i;
            $toc .= '<li><a href="#' . $anchor . '">' . strip_tags($h) . '</a></li>';
            $new_content = preg_replace('/<h2([^>]*)>' . preg_quote($h, '/') . '<\/h2>/', '<h2$1 id="' . $anchor . '">' . $h . '</h2>', $new_content, 1);
        }
        $toc .= '</ul></div>';
        $new_content = preg_replace('/<\/p>/', '</p>' . $toc, $new_content, 1);
        $changes[] = '+TOC';
    }

    // 6f. Add external link (dofollow)
    if (strpos($new_content, 'Fonte oficial') === false) {
        $ext = isset($ext_links[$cat_name]) ? $ext_links[$cat_name] : array('https://www.cbf.com.br/', 'CBF');
        $new_content .= '<p><em>Fonte oficial: <a href="' . $ext[0] . '" target="_blank" rel="noopener">' . $ext[1] . '</a></em></p>';
        $changes[] = '+ext';
    }

    // 6g. Add internal links "Leia também"
    if (strpos($new_content, 'Leia também') === false) {
        $my_cats = wp_get_post_categories($id);
        $related = get_posts(array('numberposts' => 3, 'exclude' => array($id), 'category__in' => $my_cats, 'post_status' => 'publish', 'orderby' => 'rand'));
        if (!empty($related)) {
            $links = "\n<h2>Leia também</h2>\n<ul>\n";
            foreach ($related as $r) {
                $url = 'https://papodebola.com.br/artigos/' . $r->post_name . '.html';
                $links .= '<li><a href="' . $url . '">' . $r->post_title . "</a></li>\n";
            }
            $links .= "</ul>";
            $new_content .= $links;
            $changes[] = '+3 links';
        }
    }

    // 6h. Fix any admin.papodebola URLs
    $new_content = preg_replace('#https://admin\.papodebola\.com\.br/([a-z0-9-]+)/#', 'https://papodebola.com.br/artigos/$1.html', $new_content);

    // === 7. SAVE EVERYTHING ===
    wp_update_post(array('ID' => $id, 'post_content' => $new_content, 'post_name' => $slug));

    // Rank Math meta
    update_post_meta($id, 'rank_math_focus_keyword', $all_kw);
    update_post_meta($id, 'rank_math_title', $seo_title);
    update_post_meta($id, 'rank_math_description', $desc);
    update_post_meta($id, 'rank_math_rich_snippet', 'article');
    update_post_meta($id, 'rank_math_snippet_article_type', 'NewsArticle');
    update_post_meta($id, 'rank_math_snippet_name', '%seo_title%');
    update_post_meta($id, 'rank_math_snippet_desc', '%seo_description%');
    update_post_meta($id, 'rank_math_robots', array('index', 'follow', 'max-snippet:-1', 'max-image-preview:large'));
    update_post_meta($id, 'rank_math_facebook_title', $seo_title);
    update_post_meta($id, 'rank_math_facebook_description', $desc);
    update_post_meta($id, 'rank_math_twitter_use_facebook', 'on');
    update_post_meta($id, 'rank_math_canonical_url', 'https://papodebola.com.br/artigos/' . $slug . '.html');

    // Alt text
    $thumb_id = get_post_thumbnail_id($id);
    if ($thumb_id) update_post_meta($thumb_id, '_wp_attachment_image_alt', $title . ' - Papo de Bola');

    // Excerpt
    if (empty($post->post_excerpt)) {
        wp_update_post(array('ID' => $id, 'post_excerpt' => wp_trim_words($text, 30, '...')));
    }

    $ch = implode(', ', $changes);
    echo "  #{$id} [{$ch}] KW: {$focus_kw} | " . mb_substr($title, 0, 45) . "\n";
}

echo "\n=== " . count($posts) . " posts fully optimized ===\n";
