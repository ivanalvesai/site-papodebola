#!/usr/bin/env node
/**
 * Generates sitemap.xml from articles and static pages
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://papodebola.com.br';
const SITE_DIR = path.join(__dirname, '..');
const DB_FILE = path.join(__dirname, 'articles.json');
const OUTPUT = path.join(SITE_DIR, 'sitemap.xml');

const today = new Date().toISOString().split('T')[0];

// Static pages
const pages = [
    { url: '/', priority: '1.0', freq: 'hourly' },
    { url: '/pages/ao-vivo.html', priority: '0.9', freq: 'always' },
    { url: '/pages/noticias.html', priority: '0.8', freq: 'hourly' },
    { url: '/pages/campeonato.html?id=325&name=Brasileirão Série A', priority: '0.8', freq: 'daily' },
    { url: '/pages/campeonato.html?id=390&name=Brasileirão Série B', priority: '0.7', freq: 'daily' },
    { url: '/pages/campeonato.html?id=373&name=Copa do Brasil', priority: '0.7', freq: 'daily' },
    { url: '/pages/campeonato.html?id=384&name=Copa Libertadores', priority: '0.7', freq: 'daily' },
    { url: '/pages/campeonato.html?id=7&name=Champions League', priority: '0.7', freq: 'daily' },
    { url: '/pages/campeonato.html?id=17&name=Premier League', priority: '0.6', freq: 'daily' },
    { url: '/pages/campeonato.html?id=8&name=La Liga', priority: '0.6', freq: 'daily' },
    { url: '/pages/sobre.html', priority: '0.3', freq: 'monthly' },
    { url: '/pages/contato.html', priority: '0.3', freq: 'monthly' },
    { url: '/pages/privacidade.html', priority: '0.2', freq: 'monthly' },
];

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
`;

// Static pages
pages.forEach(p => {
    xml += `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>
`;
});

// Articles
try {
    const articles = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    articles.forEach(a => {
        const date = a.pubDate ? new Date(a.pubDate).toISOString().split('T')[0] : today;
        xml += `  <url>
    <loc>${BASE_URL}${a.url}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <news:news>
      <news:publication>
        <news:name>Papo de Bola</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${date}</news:publication_date>
      <news:title>${(a.rewrittenTitle || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</news:title>
    </news:news>
  </url>
`;
    });
    console.log(`Sitemap: ${pages.length} pages + ${articles.length} articles`);
} catch(e) {
    console.log('Sitemap: no articles found, static pages only');
}

xml += '</urlset>';
fs.writeFileSync(OUTPUT, xml);
console.log(`Written: sitemap.xml (${xml.length} bytes)`);
