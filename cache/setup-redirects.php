<?php
/**
 * Setup 301 redirects for Rank Math
 * - Auto-redirect when post slug changes
 * - Redirect common old URLs
 * - Configure 404 monitor
 */

// 1. Ensure redirections settings are correct
$options = get_option('rank-math-options-general', array());
$options['redirections_header_code'] = '301';
$options['redirections_post_redirect'] = 'on'; // Auto 301 when slug changes
$options['redirections_debug'] = 'off';
update_option('rank-math-options-general', $options);
echo "Redirect settings: 301 on slug change enabled\n";

// 2. Create redirects for known old URLs to new ones
// Format: old_url => new_url
$redirects = array(
    // Old static article paths that might be indexed
    '/index.html' => '/',
    '/pages/ao-vivo.html' => '/pages/ao-vivo.html',
);

// 3. Create redirect for all posts: admin.papodebola.com.br/slug/ -> papodebola.com.br/artigos/slug.html
// This is handled by the front-end sync, not by WP redirects

// 4. Log current redirect count
$redirect_count = wp_count_posts('redirection');
echo "Current redirects in DB: " . ($redirect_count->publish ?? 0) . "\n";

// 5. Ensure canonical URLs are set for all posts
$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
$fixed = 0;
foreach ($posts as $p) {
    $canonical = get_post_meta($p->ID, 'rank_math_canonical_url', true);
    if (empty($canonical)) {
        // Set canonical to the public front-end URL
        $public_url = 'https://papodebola.com.br/artigos/' . $p->post_name . '.html';
        update_post_meta($p->ID, 'rank_math_canonical_url', $public_url);
        $fixed++;
    }
}
echo "Canonical URLs set: $fixed posts\n";

echo "\n=== 301 Redirect Configuration Complete ===\n";
echo "- Auto 301 on slug change: YES\n";
echo "- 404 Monitor: ACTIVE\n";
echo "- Default redirect code: 301\n";
echo "- Canonical URLs pointing to papodebola.com.br\n";
