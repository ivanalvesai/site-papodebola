#!/usr/bin/env node
/**
 * Rebuilds all article HTML pages from articles.json using the current template.
 * Does NOT call the API or rewrite content - just regenerates the HTML files.
 */
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.dirname(__filename);
const ARTICLES_DIR = path.join(CACHE_DIR, '..', 'artigos');
const DB_FILE = path.join(CACHE_DIR, 'articles.json');
const { generateArticleHTML } = require(path.join(CACHE_DIR, '..', 'api', 'article-template.js'));

if (!fs.existsSync(DB_FILE)) {
    console.log('No articles.json found');
    process.exit(0);
}

const articles = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
console.log(`Rebuilding ${articles.length} articles with current template...`);

let count = 0;
articles.forEach(article => {
    if (!article.slug) return;
    const html = generateArticleHTML(article);
    const filePath = path.join(ARTICLES_DIR, `${article.slug}.html`);
    fs.writeFileSync(filePath, html);
    count++;
});

console.log(`Done! ${count} articles rebuilt.`);
