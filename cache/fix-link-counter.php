<?php
/**
 * Fix Link Counter - reindex all internal links
 */
global $wpdb;

$table_links = $wpdb->prefix . 'rank_math_internal_links';
$table_meta = $wpdb->prefix . 'rank_math_internal_meta';

// Check tables exist
$exists = $wpdb->get_var("SHOW TABLES LIKE '$table_links'");
echo "Links table: " . ($exists ? "EXISTS" : "MISSING") . "\n";

$exists2 = $wpdb->get_var("SHOW TABLES LIKE '$table_meta'");
echo "Meta table: " . ($exists2 ? "EXISTS" : "MISSING") . "\n";

// Count existing data
$link_count = $wpdb->get_var("SELECT COUNT(*) FROM $table_links");
$meta_count = $wpdb->get_var("SELECT COUNT(*) FROM $table_meta");
echo "Links: $link_count | Meta: $meta_count\n\n";

// Re-count links for all posts
$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
echo "Processing " . count($posts) . " posts...\n";

$processed = 0;
foreach ($posts as $post) {
    $content = $post->post_content;

    // Count internal links
    preg_match_all('/href=["\']https?:\/\/(papodebola\.com\.br|admin\.papodebola\.com\.br)[^"\']*["\']/', $content, $internal);
    $internal_count = count($internal[0]);

    // Count external links
    preg_match_all('/href=["\']https?:\/\/(?!papodebola\.com\.br|admin\.papodebola\.com\.br)[^"\']*["\']/', $content, $external);
    $external_count = count($external[0]);

    // Update meta
    update_post_meta($post->ID, 'rank_math_internal_links_processed', 1);
    update_post_meta($post->ID, 'rank_math_pillar_content', 'off');

    // Insert into internal links table
    $wpdb->delete($table_links, array('post_id' => $post->ID));

    foreach ($internal[0] as $link) {
        preg_match('/href=["\']([^"\']+)["\']/', $link, $url_match);
        if (!empty($url_match[1])) {
            $wpdb->insert($table_links, array(
                'url' => $url_match[1],
                'post_id' => $post->ID,
                'target_post_id' => 0,
                'type' => 'internal',
            ));
        }
    }

    foreach ($external[0] as $link) {
        preg_match('/href=["\']([^"\']+)["\']/', $link, $url_match);
        if (!empty($url_match[1])) {
            $wpdb->insert($table_links, array(
                'url' => $url_match[1],
                'post_id' => $post->ID,
                'target_post_id' => 0,
                'type' => 'external',
            ));
        }
    }

    // Update meta table
    $wpdb->replace($table_meta, array(
        'object_id' => $post->ID,
        'internal_link_count' => $internal_count,
        'external_link_count' => $external_count,
    ));

    $processed++;
}

// Final counts
$final_links = $wpdb->get_var("SELECT COUNT(*) FROM $table_links");
$final_meta = $wpdb->get_var("SELECT COUNT(*) FROM $table_meta");
echo "\nDone! Processed: $processed posts\n";
echo "Links indexed: $final_links\n";
echo "Meta entries: $final_meta\n";

// Reset the status so Rank Math knows it's done
update_option('rank_math_link_count_status', '1');
echo "\nLink counter status: complete\n";
