#!/usr/bin/env node
/**
 * Papo de Bola - Micro API for article management
 * Runs on port 5055
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 5055;
const BASE_DIR = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(BASE_DIR, 'artigos');
const IMAGES_DIR = path.join(ARTICLES_DIR, 'img');
const DB_FILE = path.join(BASE_DIR, 'cache', 'articles.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const HOME_FILE = path.join(BASE_DIR, 'cache', 'home.json');
const SESSIONS = {};

// Ensure dirs
[ARTICLES_DIR, IMAGES_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Default users
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([
        { username: 'admin', password: hashPass('admin123'), role: 'admin' },
    ]));
}

function hashPass(p) {
    return crypto.createHash('sha256').update('pdb_' + p).digest('hex');
}

function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return []; }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function readUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch { return []; }
}

function generateSlug(title) {
    return title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60);
}

function authenticate(req) {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    return SESSIONS[token] || null;
}

const { generateArticleHTML } = require('./article-template.js');
function _unused(article) {
    const dateFormatted = article.pubDate
        ? new Date(article.pubDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const paragraphs = (article.rewrittenText || '')
        .split(/\n\n|\n/)
        .filter(p => p.trim())
        .map(p => `<p>${p.trim()}</p>`)
        .join('\n                    ');

    const imageTag = article.image
        ? `<img src="${article.image}" alt="${(article.rewrittenTitle || '').replace(/"/g, '&quot;')}" loading="lazy" onerror="this.style.display='none'">`
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${(article.rewrittenText || '').substring(0, 155).replace(/"/g, '&quot;')}">
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <meta name="robots" content="noindex, nofollow">
    <meta property="og:title" content="${(article.rewrittenTitle || '').replace(/"/g, '&quot;')}">
    <meta property="og:type" content="article">
    ${article.image ? `<meta property="og:image" content="${article.image}">` : ''}
    <title>${article.rewrittenTitle || 'Artigo'} - Papo de Bola</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css?v=7">
    <style>
        .article-hero { background: #fff; border-bottom: 1px solid #E2E5E9; padding: 32px 0; }
        .article-hero img { width: 100%; max-height: 440px; object-fit: cover; border-radius: 8px; margin-bottom: 24px; }
        .article-category { font-family: 'Oswald', sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #00965E; margin-bottom: 12px; }
        .article-title { font-family: 'Oswald', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.2; text-transform: uppercase; margin-bottom: 12px; color: #1A1D23; }
        .article-meta { font-size: 13px; color: #8896A6; display: flex; align-items: center; gap: 16px; }
        .article-content { padding: 32px 0 60px; max-width: 720px; margin: 0 auto; }
        .article-content p { font-family: 'Inter', sans-serif; font-size: 17px; font-weight: 400; line-height: 1.85; color: #2D3748; margin-bottom: 20px; text-align: justify; }
        .article-content p:first-child { font-size: 19px; font-weight: 500; color: #1A1D23; }
        .article-back { display: inline-flex; align-items: center; gap: 6px; color: #00965E; font-weight: 600; font-size: 14px; margin-bottom: 20px; }
        .article-back:hover { text-decoration: underline; }
        @media (max-width: 768px) { .article-title { font-size: 24px; } .article-content p { font-size: 16px; } }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-top">
            <div class="container">
                <div class="header-top-content">
                    <div class="logo"><a href="../index.html"><i class="fas fa-futbol logo-icon"></i><span class="logo-text">PAPO<span class="logo-accent">DE BOLA</span></span></a></div>
                </div>
            </div>
        </div>
        <nav class="main-nav"><div class="container"><ul class="nav-list">
            <li class="nav-item"><a href="../index.html" class="nav-link"><i class="fas fa-home"></i> Início</a></li>
            <li class="nav-item"><a href="../pages/noticias.html" class="nav-link"><i class="fas fa-newspaper"></i> Notícias</a></li>
            <li class="nav-item"><a href="../pages/ao-vivo.html" class="nav-link live-link"><span class="live-dot"></span> AO VIVO</a></li>
        </ul></div></nav>
    </header>
    <main>
        <section class="article-hero"><div class="container">
            <a href="../pages/noticias.html" class="article-back"><i class="fas fa-arrow-left"></i> Notícias</a>
            ${imageTag}
            <div class="article-category"><i class="fas fa-futbol"></i> ${article.category || 'Futebol Brasileiro'}</div>
            <h1 class="article-title">${article.rewrittenTitle || ''}</h1>
            <div class="article-meta">
                <span><i class="fas fa-clock"></i> ${dateFormatted}</span>
                <span><i class="fas fa-pen"></i> ${article.author || 'Redação Papo de Bola'}</span>
            </div>
        </div></section>
        <div class="container"><article class="article-content">${paragraphs}</article></div>
    </main>
    <footer class="footer"><div class="container"><div class="footer-bottom" style="border-top:none;padding-top:0"><p>&copy; 2026 Papo de Bola.</p></div></div></footer>
</body>
</html>`;
}

function updateHomeNews() {
    const articles = readDB();
    try {
        const homeData = JSON.parse(fs.readFileSync(HOME_FILE, 'utf8'));
        homeData.news = articles.slice(0, 15).map(a => ({
            title: a.rewrittenTitle,
            link: a.url,
            description: (a.rewrittenText || '').substring(0, 200),
            pubDate: a.pubDate,
            image: a.image,
            local: true,
        }));
        fs.writeFileSync(HOME_FILE, JSON.stringify(homeData));
    } catch(e) { /* home.json might not exist yet */ }
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve(null); }
        });
    });
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') return sendJSON(res, 200, {});

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // === AUTH ===
    if (pathname === '/api/login' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body?.username || !body?.password) return sendJSON(res, 400, { error: 'Missing credentials' });

        const users = readUsers();
        const user = users.find(u => u.username === body.username && u.password === hashPass(body.password));
        if (!user) return sendJSON(res, 401, { error: 'Invalid credentials' });

        const token = crypto.randomBytes(32).toString('hex');
        SESSIONS[token] = { username: user.username, role: user.role, created: Date.now() };

        return sendJSON(res, 200, { token, username: user.username, role: user.role });
    }

    // All other routes require auth
    if (pathname.startsWith('/api/') && pathname !== '/api/login') {
        const user = authenticate(req);
        if (!user) return sendJSON(res, 401, { error: 'Unauthorized' });
    }

    // === ARTICLES ===
    if (pathname === '/api/articles' && req.method === 'GET') {
        const articles = readDB();
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const start = (page - 1) * limit;

        return sendJSON(res, 200, {
            articles: articles.slice(start, start + limit),
            total: articles.length,
            page,
            pages: Math.ceil(articles.length / limit),
        });
    }

    if (pathname === '/api/articles' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body?.title || !body?.text) return sendJSON(res, 400, { error: 'Title and text required' });

        const slug = generateSlug(body.title);
        const article = {
            originalTitle: body.title,
            rewrittenTitle: body.title,
            rewrittenText: body.text,
            slug,
            source: 'Manual',
            image: body.image || '',
            category: body.category || 'Futebol Brasileiro',
            author: body.author || 'Redação Papo de Bola',
            pubDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            url: `/artigos/${slug}.html`,
        };

        // Generate HTML
        fs.writeFileSync(path.join(ARTICLES_DIR, `${slug}.html`), generateArticleHTML(article));

        // Save to DB
        const articles = readDB();
        articles.unshift(article);
        writeDB(articles);
        updateHomeNews();

        return sendJSON(res, 201, { article });
    }

    const articleMatch = pathname.match(/^\/api\/articles\/(.+)$/);

    if (articleMatch && req.method === 'PUT') {
        const slug = articleMatch[1];
        const body = await parseBody(req);
        const articles = readDB();
        const index = articles.findIndex(a => a.slug === slug);
        if (index === -1) return sendJSON(res, 404, { error: 'Article not found' });

        if (body.title) articles[index].rewrittenTitle = body.title;
        if (body.text) articles[index].rewrittenText = body.text;
        if (body.image !== undefined) articles[index].image = body.image;
        if (body.category) articles[index].category = body.category;
        if (body.author) articles[index].author = body.author;
        articles[index].updatedAt = new Date().toISOString();

        // Regenerate HTML
        fs.writeFileSync(path.join(ARTICLES_DIR, `${slug}.html`), generateArticleHTML(articles[index]));

        writeDB(articles);
        updateHomeNews();

        return sendJSON(res, 200, { article: articles[index] });
    }

    if (articleMatch && req.method === 'DELETE') {
        const slug = articleMatch[1];
        const articles = readDB();
        const filtered = articles.filter(a => a.slug !== slug);
        if (filtered.length === articles.length) return sendJSON(res, 404, { error: 'Not found' });

        // Remove files
        const htmlFile = path.join(ARTICLES_DIR, `${slug}.html`);
        const imgFile = path.join(IMAGES_DIR, `${slug}.jpg`);
        if (fs.existsSync(htmlFile)) fs.unlinkSync(htmlFile);
        if (fs.existsSync(imgFile)) fs.unlinkSync(imgFile);

        writeDB(filtered);
        updateHomeNews();

        return sendJSON(res, 200, { deleted: slug });
    }

    // === IMAGE UPLOAD ===
    if (pathname === '/api/upload' && req.method === 'POST') {
        return new Promise((resolve) => {
            const chunks = [];
            req.on('data', c => chunks.push(c));
            req.on('end', () => {
                const buffer = Buffer.concat(chunks);
                // Expect JSON with base64 image
                try {
                    const body = JSON.parse(buffer.toString());
                    if (!body.filename || !body.data) return sendJSON(res, 400, { error: 'filename and data required' });

                    const safeName = body.filename.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
                    const filePath = path.join(IMAGES_DIR, safeName);
                    const imageBuffer = Buffer.from(body.data, 'base64');
                    fs.writeFileSync(filePath, imageBuffer);

                    sendJSON(res, 200, { url: `/artigos/img/${safeName}` });
                } catch(e) {
                    sendJSON(res, 400, { error: 'Invalid upload data' });
                }
                resolve();
            });
        });
    }

    // === USERS (admin only) ===
    if (pathname === '/api/users' && req.method === 'GET') {
        const user = authenticate(req);
        if (user?.role !== 'admin') return sendJSON(res, 403, { error: 'Admin only' });
        const users = readUsers().map(u => ({ username: u.username, role: u.role }));
        return sendJSON(res, 200, { users });
    }

    if (pathname === '/api/users' && req.method === 'POST') {
        const user = authenticate(req);
        if (user?.role !== 'admin') return sendJSON(res, 403, { error: 'Admin only' });

        const body = await parseBody(req);
        if (!body?.username || !body?.password) return sendJSON(res, 400, { error: 'Missing fields' });

        const users = readUsers();
        if (users.find(u => u.username === body.username)) return sendJSON(res, 409, { error: 'User exists' });

        users.push({ username: body.username, password: hashPass(body.password), role: body.role || 'editor' });
        fs.writeFileSync(USERS_FILE, JSON.stringify(users));

        return sendJSON(res, 201, { message: 'User created' });
    }

    sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`Papo de Bola API running on port ${PORT}`));
