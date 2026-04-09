<?php
/**
 * Rank Math SEO Configuration Script
 * Run inside WordPress container: wp eval-file /tmp/configure-rankmath.php --allow-root
 */

// General Options
$general = get_option('rank-math-options-general', array());
$general['breadcrumbs'] = 'on';
$general['rich_snippet'] = 'on';
$general['noindex_empty_taxonomies'] = 'on';
$general['noindex_search'] = 'on';
$general['noindex_date_archive'] = 'on';
$general['noindex_author_archive'] = 'on';
$general['attachment_redirect_urls'] = 'on';
$general['strip_category_base'] = 'on';
$general['open_graph'] = 'on';
$general['twitter_card_type'] = 'summary_large_image';
$general['nofollow_external_links'] = 'on';
$general['new_window_external_links'] = 'on';
$general['ping_search_engines'] = 'on';
$general['redirections_header_code'] = '301';
$general['console_email_reports'] = 'on';
$general['link_builder'] = 'on';
$general['image_seo'] = 'on';
$general['image_seo_alt_format'] = '%title% - Papo de Bola';
$general['image_seo_title_format'] = '%title% - Papo de Bola';
update_option('rank-math-options-general', $general);
echo "General: OK\n";

// Titles & Meta
$titles = get_option('rank-math-options-titles', array());
$titles['title_separator'] = '-';
$titles['homepage_title'] = 'Papo de Bola - Futebol Ao Vivo, Placares, Notícias e Classificações';
$titles['homepage_description'] = 'Portal completo de futebol brasileiro e mundial. Acompanhe jogos ao vivo, placares em tempo real, classificações do Brasileirão, Copa do Brasil, Libertadores, Champions League. Notícias, transferências e análises dos principais times.';
$titles['pt_post_title'] = '%title% - Papo de Bola';
$titles['pt_post_description'] = '%excerpt%';
$titles['pt_post_default_rich_snippet'] = 'article';
$titles['pt_post_default_article_type'] = 'NewsArticle';
$titles['pt_post_default_snippet_name'] = '%title%';
$titles['pt_post_default_snippet_desc'] = '%excerpt%';
$titles['tax_category_title'] = '%term% - Notícias de Futebol | Papo de Bola';
$titles['tax_category_description'] = 'Últimas notícias sobre %term%. Acompanhe resultados, transferências e análises no Papo de Bola.';
$titles['tax_post_tag_title'] = 'Notícias do %term% | Papo de Bola';
$titles['tax_post_tag_description'] = 'Todas as notícias sobre %term%. Jogos, resultados, contratações e mais no Papo de Bola.';
$titles['author_archive_title'] = '%name% - Papo de Bola';
$titles['date_archive_title'] = '%date% - Papo de Bola';
$titles['search_title'] = 'Resultados para "%search_query%" - Papo de Bola';
$titles['404_title'] = 'Página não encontrada - Papo de Bola';
update_option('rank-math-options-titles', $titles);
echo "Titles: OK\n";

// Sitemap
$sitemap = get_option('rank-math-options-sitemap', array());
$sitemap['items_per_page'] = 200;
$sitemap['include_images'] = 'on';
$sitemap['ping_search_engines'] = 'on';
$sitemap['pt_post_sitemap'] = 'on';
$sitemap['pt_page_sitemap'] = 'on';
$sitemap['tax_category_sitemap'] = 'on';
$sitemap['tax_post_tag_sitemap'] = 'on';
update_option('rank-math-options-sitemap', $sitemap);
echo "Sitemap: OK\n";

echo "\n=== Rank Math configured ===\n";
