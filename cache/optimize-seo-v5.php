<?php
/**
 * SEO v5 - Fix remaining Rank Math issues:
 * 1. KW density to ~1% (add KW 5-8 times naturally)
 * 2. Shorten URLs to < 75 chars
 * 3. Add Table of Contents
 * 4. Break long paragraphs (max 150 words each)
 * 5. Remove nofollow from external links (Rank Math wants dofollow)
 */

// Install TOC shortcode support
function pdb_toc_shortcode() {
    return '<!-- TOC handled by Rank Math -->';
}
if (!shortcode_exists('toc')) add_shortcode('toc', 'pdb_toc_shortcode');

$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
echo count($posts) . " posts to fix\n\n";

$fixed = 0;

foreach ($posts as $post) {
    $id = $post->ID;
    $title = $post->post_title;
    $content = $post->post_content;
    $slug = $post->post_name;
    $changes = array();

    // Get primary keyword
    $kw_raw = get_post_meta($id, 'rank_math_focus_keyword', true);
    $primary_kw = trim(explode(',', $kw_raw)[0]);
    if (empty($primary_kw)) continue;

    $new_content = $content;

    // === 1. SHORTEN URL if > 75 chars ===
    if (strlen($slug) > 75) {
        // Keep first 70 chars, cut at last word boundary
        $new_slug = substr($slug, 0, 70);
        $last_dash = strrpos($new_slug, '-');
        if ($last_dash > 40) $new_slug = substr($new_slug, 0, $last_dash);
        wp_update_post(array('ID' => $id, 'post_name' => $new_slug));
        $changes[] = 'slug: ' . strlen($slug) . '->' . strlen($new_slug);
    }

    // === 2. INCREASE KW DENSITY to ~1% ===
    $kw_lower = mb_strtolower($primary_kw);
    $text = mb_strtolower(strip_tags($new_content));
    $word_count = str_word_count($text);
    $kw_count = mb_substr_count($text, $kw_lower);
    $target_count = max(5, intval($word_count * 0.01)); // 1% density

    if ($kw_count < $target_count) {
        $needed = $target_count - $kw_count;
        $paragraphs = explode('</p>', $new_content);
        $total_p = count($paragraphs);

        if ($total_p > 4) {
            // Distribute KW evenly through content
            $interval = max(1, intval($total_p / ($needed + 1)));
            $added = 0;

            for ($i = 1; $i < $total_p && $added < $needed; $i += $interval) {
                if (isset($paragraphs[$i]) && mb_strlen(strip_tags($paragraphs[$i])) > 30) {
                    // Add KW as a natural sentence variation
                    $variations = array(
                        ' Sobre ' . $primary_kw . ', vale acompanhar os desdobramentos.',
                        ' O cenário envolvendo ' . $primary_kw . ' segue em evolução.',
                        ' A situação de ' . $primary_kw . ' merece atenção.',
                    );
                    $var = $variations[$added % count($variations)];
                    $paragraphs[$i] .= $var;
                    $added++;
                }
            }
            $new_content = implode('</p>', $paragraphs);
            $changes[] = "+{$added} KW ({$kw_count}->" . ($kw_count + $added) . ")";
        }
    }

    // === 3. BREAK LONG PARAGRAPHS (max ~120 words) ===
    $paragraphs = preg_split('/(<\/p>\s*<p>|<\/p>\s*<h[23]|<h[23])/i', $new_content, -1, PREG_SPLIT_DELIM_CAPTURE);
    $rebuilt = '';
    foreach ($paragraphs as $para) {
        $stripped = strip_tags($para);
        $wc = str_word_count($stripped);
        if ($wc > 120 && strpos($para, '<h') === false) {
            // Split at sentence boundary near middle
            $sentences = preg_split('/(?<=[.!?])\s+/', $stripped);
            if (count($sentences) > 2) {
                $mid = intval(count($sentences) / 2);
                $first = implode(' ', array_slice($sentences, 0, $mid));
                $second = implode(' ', array_slice($sentences, $mid));
                $rebuilt .= '<p>' . $first . '</p><p>' . $second;
                $changes[] = 'split para';
                continue;
            }
        }
        $rebuilt .= $para;
    }
    $new_content = $rebuilt;

    // === 4. ADD TABLE OF CONTENTS after first paragraph ===
    if (strpos($new_content, '[toc]') === false && strpos($new_content, 'rank-math-toc') === false) {
        // Count H2 headings
        preg_match_all('/<h2[^>]*>(.*?)<\/h2>/i', $new_content, $headings);
        if (count($headings[1]) >= 3) {
            // Generate HTML TOC
            $toc = '<div class="rank-math-toc-widget" style="background:#f8f9fa;border:1px solid #e2e5e9;border-radius:8px;padding:16px 20px;margin:20px 0">';
            $toc .= '<strong style="display:block;margin-bottom:8px">Neste artigo:</strong><ul style="margin:0;padding-left:20px">';
            foreach ($headings[1] as $i => $h) {
                $anchor = 'section-' . $i;
                $toc .= '<li><a href="#' . $anchor . '">' . strip_tags($h) . '</a></li>';
                // Add id to the heading
                $new_content = preg_replace(
                    '/<h2([^>]*)>' . preg_quote($h, '/') . '<\/h2>/',
                    '<h2$1 id="' . $anchor . '">' . $h . '</h2>',
                    $new_content,
                    1
                );
            }
            $toc .= '</ul></div>';

            // Insert after first paragraph
            $new_content = preg_replace('/<\/p>/', '</p>' . $toc, $new_content, 1);
            $changes[] = '+TOC';
        }
    }

    // === 5. FIX EXTERNAL LINKS: remove nofollow (Rank Math wants some dofollow) ===
    $new_content = preg_replace('/rel="nofollow noopener"/', 'rel="noopener"', $new_content, 1);
    if (preg_match('/nofollow/', $content) && !preg_match('/nofollow/', $new_content)) {
        $changes[] = 'dofollow';
    }

    // === 6. UPDATE CONTENT ===
    if ($new_content !== $content) {
        wp_update_post(array('ID' => $id, 'post_content' => $new_content));
    }

    $fixed++;
    $ch = implode(', ', $changes);
    if (!empty($ch)) echo "  #{$id} [{$ch}] | " . mb_substr($title, 0, 50) . "\n";
}

echo "\n=== {$fixed} posts fixed ===\n";
