<?php
/**
 * Fix posts without featured images by uploading from local artigos/img/
 */
$posts = get_posts(array('numberposts' => -1, 'post_status' => 'publish'));
$fixed = 0;
$already = 0;

foreach ($posts as $p) {
    if (has_post_thumbnail($p->ID)) { $already++; continue; }

    // Try to find matching image
    $slug = $p->post_name;
    $img_dir = '/var/www/papodebola/artigos/img/';
    $img_path = null;

    // Direct match
    if (file_exists($img_dir . $slug . '.jpg')) {
        $img_path = $img_dir . $slug . '.jpg';
    } else {
        // Partial match - first 20 chars of slug
        $partial = substr($slug, 0, 20);
        $files = glob($img_dir . $partial . '*.jpg');
        if (!empty($files)) $img_path = $files[0];
    }

    if (!$img_path) {
        // Use any available stadium image as fallback
        $fallbacks = glob($img_dir . '*.jpg');
        if (!empty($fallbacks)) {
            $img_path = $fallbacks[array_rand($fallbacks)];
        }
    }

    if ($img_path && file_exists($img_path)) {
        // Copy to uploads
        $upload_dir = wp_upload_dir();
        $filename = basename($img_path);
        $dest = $upload_dir['path'] . '/' . $filename;

        if (!file_exists($dest)) copy($img_path, $dest);

        $attachment = array(
            'post_mime_type' => 'image/jpeg',
            'post_title' => sanitize_file_name(pathinfo($filename, PATHINFO_FILENAME)),
            'post_content' => '',
            'post_status' => 'inherit',
        );

        $attach_id = wp_insert_attachment($attachment, $dest, $p->ID);
        if ($attach_id && !is_wp_error($attach_id)) {
            require_once(ABSPATH . 'wp-admin/includes/image.php');
            $meta = wp_generate_attachment_metadata($attach_id, $dest);
            wp_update_attachment_metadata($attach_id, $meta);
            set_post_thumbnail($p->ID, $attach_id);

            // Set alt text
            update_post_meta($attach_id, '_wp_attachment_image_alt', $p->post_title . ' - Papo de Bola');

            $fixed++;
            echo "  Fixed #{$p->ID} -> media #{$attach_id} | " . substr($p->post_title, 0, 40) . "\n";
        }
    }
}

echo "\nAlready had image: $already\n";
echo "Fixed: $fixed\n";
echo "Total: " . count($posts) . "\n";
