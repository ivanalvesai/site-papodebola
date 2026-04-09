#!/usr/bin/env node
/**
 * Syncs articles from WordPress REST API to the front-end cache.
 * Pulls published posts and generates home.json news section.
 * Also generates static HTML article pages for SEO.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.dirname(__filename);
const ARTICLES_DIR = path.join(CACHE_DIR, '..', 'artigos');
const IMAGES_DIR = path.join(ARTICLES_DIR, 'img');
const WP_BASE = 'https://admin.papodebola.com.br/wp-json/wp/v2';
const WP_USER = 'ivanalves';
const WP_APP_PASS = 'HeYF 49xY pg73 dhQi 5zZq 4B6K';
const AUTH = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASS}`).toString('base64');

[ARTICLES_DIR, IMAGES_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const { generateArticleHTML } = require(path.join(CACHE_DIR, '..', 'api', 'article-template.js'));

function wpFetch(endpoint) {
    return new Promise((resolve) => {
        const url = `${WP_BASE}/${endpoint}`;
        https.get(url, {
            headers: { 'Authorization': AUTH },
            rejectUnauthorized: false,
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function main() {
    console.log('Syncing WordPress posts to front-end...');

    // Fetch categories and tags for mapping
    const categories = await wpFetch('categories?per_page=50');
    const tags = await wpFetch('tags?per_page=100');

    const catMap = {};
    const tagMap = {};
    if (categories) categories.forEach(c => catMap[c.id] = c.name);
    if (tags) tags.forEach(t => tagMap[t.id] = t.slug);

    console.log(`  Categories: ${Object.keys(catMap).length}, Tags: ${Object.keys(tagMap).length}`);

    // Fetch published posts
    const posts = await wpFetch('posts?per_page=50&orderby=date&order=desc&_embed');
    if (!posts || !Array.isArray(posts)) {
        console.log('  No posts found or API error');
        return;
    }

    console.log(`  Posts: ${posts.length}`);

    const articles = [];

    for (const post of posts) {
        const slug = post.slug;
        const title = post.title?.rendered || '';
        const content = (post.content?.rendered || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const excerpt = (post.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim();
        const featuredImage = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
        const postCats = (post.categories || []).map(id => catMap[id]).filter(Boolean);
        const postTags = (post.tags || []).map(id => tagMap[id]).filter(Boolean);
        const category = postCats[0] || 'Futebol Brasileiro';

        // Download featured image locally
        let localImage = '';
        if (featuredImage) {
            const imgPath = path.join(IMAGES_DIR, `${slug}.jpg`);
            if (!fs.existsSync(imgPath)) {
                try {
                    const imgData = await new Promise((resolve) => {
                        const proto = featuredImage.startsWith('https') ? https : require('http');
                        proto.get(featuredImage, { rejectUnauthorized: false }, res => {
                            const chunks = [];
                            res.on('data', c => chunks.push(c));
                            res.on('end', () => resolve(Buffer.concat(chunks)));
                        }).on('error', () => resolve(null));
                    });
                    if (imgData && imgData.length > 1000) {
                        fs.writeFileSync(imgPath, imgData);
                        localImage = `/artigos/img/${slug}.jpg`;
                    }
                } catch {}
            } else {
                localImage = `/artigos/img/${slug}.jpg`;
            }
        }

        const article = {
            originalTitle: title,
            rewrittenTitle: title,
            rewrittenText: content.substring(0, 5000),
            slug,
            source: 'WordPress',
            image: localImage || featuredImage,
            category,
            tags: postTags,
            team: postTags[0] || null,
            author: post._embedded?.author?.[0]?.name || 'Redação Papo de Bola',
            pubDate: post.date,
            createdAt: post.date,
            url: `/artigos/${slug}.html`,
            wpId: post.id,
        };

        articles.push(article);

        // Generate static HTML page
        const html = generateArticleHTML(article);
        fs.writeFileSync(path.join(ARTICLES_DIR, `${slug}.html`), html);
    }

    // Save articles cache
    fs.writeFileSync(path.join(CACHE_DIR, 'articles.json'), JSON.stringify(articles, null, 2));

    // Update home.json
    const homeFile = path.join(CACHE_DIR, 'home.json');
    try {
        const homeData = JSON.parse(fs.readFileSync(homeFile, 'utf8'));
        homeData.news = articles.slice(0, 15).map(a => ({
            title: a.rewrittenTitle,
            link: a.url,
            description: a.rewrittenText.substring(0, 200),
            pubDate: a.pubDate,
            image: a.image,
            local: true,
        }));
        fs.writeFileSync(homeFile, JSON.stringify(homeData));
    } catch {}

    console.log(`  Synced ${articles.length} posts. Static pages generated.`);
}

main().catch(console.error);
