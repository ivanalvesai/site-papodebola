#!/usr/bin/env node
/**
 * Migrates existing HTML articles to WordPress
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', 'artigos');
const IMAGES_DIR = path.join(ARTICLES_DIR, 'img');
const WP_BASE = 'https://admin.papodebola.com.br/wp-json/wp/v2';
const WP_USER = 'ivanalves';
const WP_APP_PASS = 'HeYF 49xY pg73 dhQi 5zZq 4B6K';
const WP_AUTH = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASS}`).toString('base64');

function wpRequest(endpoint, method, data) {
    return new Promise((resolve) => {
        const body = data ? JSON.stringify(data) : '';
        const options = {
            hostname: 'admin.papodebola.com.br',
            path: `/wp-json/wp/v2/${endpoint}`,
            method,
            headers: {
                'Authorization': WP_AUTH,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
            rejectUnauthorized: false,
        };

        const req = https.request(options, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(30000, () => { req.destroy(); resolve(null); });
        if (body) req.write(body);
        req.end();
    });
}

function wpUploadImage(filePath, filename) {
    return new Promise((resolve) => {
        const imageData = fs.readFileSync(filePath);
        const options = {
            hostname: 'admin.papodebola.com.br',
            path: '/wp-json/wp/v2/media',
            method: 'POST',
            headers: {
                'Authorization': WP_AUTH,
                'Content-Type': 'image/jpeg',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': imageData.length,
            },
            rejectUnauthorized: false,
        };

        const req = https.request(options, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(60000, () => { req.destroy(); resolve(null); });
        req.write(imageData);
        req.end();
    });
}

async function getCategories() {
    const cats = await wpRequest('categories?per_page=50', 'GET');
    const map = {};
    if (cats) cats.forEach(c => map[c.name.toLowerCase()] = c.id);
    return map;
}

async function getTags() {
    const tags = await wpRequest('tags?per_page=100', 'GET');
    const map = {};
    if (tags) tags.forEach(t => map[t.name.toLowerCase()] = t.id);
    return map;
}

async function getOrCreateTag(name, tagsMap) {
    const lower = name.toLowerCase();
    if (tagsMap[lower]) return tagsMap[lower];

    const result = await wpRequest('tags', 'POST', { name });
    if (result?.id) {
        tagsMap[lower] = result.id;
        return result.id;
    }
    return null;
}

function extractFromHTML(htmlFile) {
    const html = fs.readFileSync(htmlFile, 'utf8');

    // Extract title
    const titleMatch = html.match(/<h1[^>]*class="article-title"[^>]*>(.*?)<\/h1>/s);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(htmlFile, '.html');

    // Extract content paragraphs
    const contentMatch = html.match(/<article[^>]*class="article-content"[^>]*>([\s\S]*?)<\/article>/);
    let content = '';
    if (contentMatch) {
        content = contentMatch[1].trim();
    }

    // Extract category
    const catMatch = html.match(/article-category[^>]*>.*?<a[^>]*>([^<]+)<\/a>/);
    const category = catMatch ? catMatch[1].trim() : 'Futebol Brasileiro';

    // Extract date
    const dateMatch = html.match(/"datePublished":\s*"([^"]+)"/);
    const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString();

    // Extract tags from article-tag links
    const tagRegex = /class="article-tag"[^>]*>.*?([^<]+)<\/a>/g;
    const tags = [];
    let m;
    while ((m = tagRegex.exec(html)) !== null) {
        const tag = m[1].trim();
        if (tag && !tag.includes('fa-') && tag.length > 1) tags.push(tag);
    }

    const slug = path.basename(htmlFile, '.html');

    return { title, content, category, pubDate, tags, slug };
}

async function main() {
    console.log('=== Migrating articles to WordPress ===\n');

    const catMap = await getCategories();
    const tagsMap = await getTags();
    console.log(`Categories: ${Object.keys(catMap).length}, Tags: ${Object.keys(tagsMap).length}\n`);

    // Get existing WP posts to avoid duplicates
    const existingPosts = await wpRequest('posts?per_page=100&status=any', 'GET');
    const existingTitles = new Set((existingPosts || []).map(p => p.title?.rendered));

    const htmlFiles = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.html')).sort();
    console.log(`Found ${htmlFiles.length} articles to migrate\n`);

    let migrated = 0;
    let skipped = 0;

    for (const file of htmlFiles) {
        const article = extractFromHTML(path.join(ARTICLES_DIR, file));

        // Skip if already exists in WP
        if (existingTitles.has(article.title)) {
            console.log(`  [SKIP] ${article.title.substring(0, 50)}...`);
            skipped++;
            continue;
        }

        // Get category ID
        const catId = catMap[article.category.toLowerCase()] || 1;

        // Get/create tag IDs
        const tagIds = [];
        for (const tag of article.tags) {
            const tagId = await getOrCreateTag(tag, tagsMap);
            if (tagId) tagIds.push(tagId);
        }

        // Upload featured image if exists
        let featuredImageId = null;
        const imgPath = path.join(IMAGES_DIR, `${article.slug}.jpg`);
        if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 1000) {
            console.log(`  [IMG] Uploading ${article.slug}.jpg...`);
            const media = await wpUploadImage(imgPath, `${article.slug}.jpg`);
            if (media?.id) {
                featuredImageId = media.id;
                console.log(`  [IMG] OK: media #${media.id}`);
            }
        }

        // Create post
        const postData = {
            title: article.title,
            content: article.content,
            status: 'publish',
            categories: [catId],
            tags: tagIds,
            date: article.pubDate,
            slug: article.slug,
        };

        if (featuredImageId) {
            postData.featured_media = featuredImageId;
        }

        const post = await wpRequest('posts', 'POST', postData);

        if (post?.id) {
            console.log(`  [OK] #${post.id} ${article.title.substring(0, 50)}`);
            migrated++;
        } else {
            console.log(`  [ERR] ${article.title.substring(0, 50)} - ${post?.message || 'unknown error'}`);
        }

        // Small delay to not overwhelm the server
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n=== Migration complete ===`);
    console.log(`Migrated: ${migrated}, Skipped: ${skipped}, Total HTML: ${htmlFiles.length}`);
}

main().catch(console.error);
