<?php
/**
 * SEO Final - Fix remaining issues for all posts:
 * 1. Shorten slugs to < 60 chars
 * 2. Remove nofollow from external links
 * 3. Add "Leia também" section with 3 internal links
 */

$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
echo count($posts) . " posts\n\n";

foreach ($posts as $post) {
    $id = $post->ID;
    $slug = $post->post_name;
    $content = $post->post_content;
    $changes = array();

    // 1. SHORTEN SLUG
    if (strlen($slug) > 60) {
        $new_slug = substr($slug, 0, 55);
        $last = strrpos($new_slug, '-');
        if ($last > 30) $new_slug = substr($new_slug, 0, $last);
        $changes[] = 'slug ' . strlen($slug) . '->' . strlen($new_slug);
        $slug = $new_slug;
    }

    // 2. REMOVE NOFOLLOW
    $new_content = str_replace('nofollow noopener', 'noopener', $content);
    $new_content = str_replace('rel="nofollow"', '', $new_content);
    if ($new_content !== $content) $changes[] = 'dofollow';

    // 3. ADD INTERNAL LINKS if missing
    if (strpos($new_content, 'Leia também') === false) {
        $my_cats = wp_get_post_categories($id);
        $related = get_posts(array(
            'numberposts' => 3,
            'exclude' => array($id),
            'category__in' => $my_cats,
            'post_status' => 'publish',
            'orderby' => 'rand',
        ));

        if (!empty($related)) {
            $links = "\n<h2>Leia também</h2>\n<ul>\n";
            foreach ($related as $r) {
                $public_url = 'https://papodebola.com.br/artigos/' . $r->post_name . '.html';
                $links .= '<li><a href="' . $public_url . '">' . $r->post_title . "</a></li>\n";
            }
            $links .= "</ul>";
            $new_content .= $links;
            $changes[] = '+3 internal links';
        }

        // Fix any admin.papodebola URLs to public
        $new_content = preg_replace('#https://admin\.papodebola\.com\.br/([a-z0-9-]+)/#', 'https://papodebola.com.br/artigos/$1.html', $new_content);
    }

    // SAVE
    if (!empty($changes)) {
        wp_update_post(array(
            'ID' => $id,
            'post_content' => $new_content,
            'post_name' => $slug,
        ));
        echo "  #{$id} [" . implode(', ', $changes) . "] | " . mb_substr($post->post_title, 0, 45) . "\n";
    }
}

echo "\nDone!\n";
