#!/usr/bin/env node
/**
 * Fetches news from RSS feeds, rewrites with Claude AI,
 * and generates local article pages.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.dirname(__filename);
const ARTICLES_DIR = path.join(CACHE_DIR, '..', 'artigos');
const IMAGES_DIR = path.join(ARTICLES_DIR, 'img');
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const HF_TOKENS = [
    process.env.HUGGINGFACE_TOKEN || '',
    process.env.HUGGINGFACE_TOKEN_2 || '',
    process.env.HUGGINGFACE_TOKEN_3 || '',
].filter(t => t);
const ARTICLES_DB = path.join(CACHE_DIR, 'articles.json');

// Ensure directories exist
if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

function fetchURL(url) {
    return new Promise((resolve) => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PapoDeBola/1.0)' } }, res => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchURL(res.headers.location).then(resolve);
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', () => resolve(''));
    });
}

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const get = (tag) => {
            const m = content.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
            return m ? (m[1] || m[2] || '').trim() : '';
        };

        let image = '';
        const imgMatch = content.match(/<media:content[^>]+url="([^"]+)"/) ||
                         content.match(/<enclosure[^>]+url="([^"]+)"/) ||
                         content.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) image = imgMatch[1];

        // Get full content if available
        const fullContent = get('content:encoded') || get('description') || '';
        const cleanText = fullContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        items.push({
            title: get('title'),
            link: get('link'),
            description: cleanText.substring(0, 500),
            fullText: cleanText.substring(0, 2000),
            pubDate: get('pubDate'),
            image,
            source: '',
        });
    }
    return items;
}

async function rewriteWithClaude(title, text) {
    if (!ANTHROPIC_KEY) {
        console.log('  [SKIP] No ANTHROPIC_API_KEY - using original text');
        return { title, text };
    }

    return new Promise((resolve) => {
        const body = JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [{
                role: 'user',
                content: `Você é um jornalista esportivo brasileiro. Reescreva a notícia abaixo com suas próprias palavras, mantendo as informações factuais (nomes, placares, datas). Crie um título atrativo e um texto de 3-4 parágrafos em português do Brasil, com linguagem natural de portal esportivo. NÃO copie frases do original.

Título original: ${title}

Texto original: ${text}

Responda APENAS no formato JSON:
{"title": "novo título", "text": "texto reescrito com parágrafos separados por \\n\\n"}`
            }]
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const content = response.content?.[0]?.text || '';
                    // Extract JSON from response
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        resolve({ title: parsed.title || title, text: parsed.text || text });
                    } else {
                        resolve({ title, text });
                    }
                } catch(e) {
                    console.log('  [WARN] Claude parse error:', e.message);
                    resolve({ title, text });
                }
            });
        });

        req.on('error', () => resolve({ title, text }));
        req.setTimeout(30000, () => { req.destroy(); resolve({ title, text }); });
        req.write(body);
        req.end();
    });
}

// Map Brazilian teams to their real jersey descriptions
const TEAM_JERSEYS = {
    'corinthians': 'wearing white jersey with black collar and black shorts, Corinthians style uniform',
    'palmeiras': 'wearing green jersey with white details and white shorts, Palmeiras style uniform',
    'flamengo': 'wearing red and black horizontal striped jersey and white shorts, Flamengo style uniform',
    'são paulo': 'wearing white jersey with red and black horizontal stripe on chest, São Paulo style uniform',
    'santos': 'wearing all white jersey and white shorts, Santos FC style uniform',
    'vasco': 'wearing white jersey with black diagonal stripe and black shorts, Vasco style uniform',
    'fluminense': 'wearing jersey with maroon green and white vertical stripes, Fluminense style uniform',
    'botafogo': 'wearing black and white vertical striped jersey, Botafogo style uniform',
    'grêmio': 'wearing blue jersey with black vertical stripes and white shorts, Grêmio style uniform',
    'internacional': 'wearing red jersey and white shorts, Internacional style uniform',
    'atlético': 'wearing black and white vertical striped jersey, Atlético Mineiro style uniform',
    'cruzeiro': 'wearing blue jersey with white details, Cruzeiro style uniform',
    'bahia': 'wearing white jersey with blue and red details, Bahia style uniform',
    'fortaleza': 'wearing red blue and white striped jersey, Fortaleza style uniform',
    'athletico': 'wearing red and black jersey, Athletico Paranaense style uniform',
    'coritiba': 'wearing green and white jersey, Coritiba style uniform',
    'neymar': 'Brazilian football star with blond mohawk hairstyle wearing Santos white jersey',
    'militão': 'Brazilian defender wearing Real Madrid all white jersey',
    'real madrid': 'wearing all white jersey and white shorts, Real Madrid style uniform',
    'barcelona': 'wearing blue and red vertical striped jersey, Barcelona style uniform',
    'cusco': 'wearing red jersey, Peruvian football team',
};

function detectTeamJersey(title) {
    const lower = title.toLowerCase();
    for (const [team, desc] of Object.entries(TEAM_JERSEYS)) {
        if (lower.includes(team)) return desc;
    }
    return 'wearing generic football jersey';
}

async function generateImagePrompt(title) {
    const jerseyDesc = detectTeamJersey(title);

    if (!ANTHROPIC_KEY) return `Sports photography, Brazilian football player ${jerseyDesc}, stadium atmosphere, action shot, editorial photo, high quality, cinematic lighting`;

    return new Promise((resolve) => {
        const body = JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{
                role: 'user',
                content: `Create a FLUX image generation prompt in English for a sports article cover photo.

CRITICAL RULES:
- The image must look like REAL sports photography (editorial, cinematic)
- Players must wear the CORRECT team uniform described below
- NO text, NO logos, NO words in the image
- Include: dramatic lighting, stadium background, action or emotion
- Be specific about the scene based on the article title

Team uniform to use: ${jerseyDesc}
Article title: ${title}

Reply with ONLY the prompt, nothing else. Max 60 words.`
            }]
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const prompt = response.content?.[0]?.text?.trim() || '';
                    resolve(prompt || `Brazilian football editorial photography, stadium, action, ${title}`);
                } catch(e) {
                    resolve(`Brazilian football editorial photography, stadium, action shot`);
                }
            });
        });

        req.on('error', () => resolve('Brazilian football editorial photography, stadium, action shot'));
        req.setTimeout(15000, () => { req.destroy(); resolve('Brazilian football editorial photography, stadium'); });
        req.write(body);
        req.end();
    });
}

async function generateFluxImage(prompt, slug) {
    const imagePath = path.join(IMAGES_DIR, `${slug}.jpg`);

    // Skip if image already exists
    if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 5000) {
        console.log(`  [CACHED] Image already exists: ${slug}.jpg`);
        return `/artigos/img/${slug}.jpg`;
    }

    for (let i = 0; i < HF_TOKENS.length; i++) {
        const token = HF_TOKENS[i];
        try {
            console.log(`  [FLUX] Generating with token ${i + 1}...`);

            const result = await new Promise((resolve, reject) => {
                const body = JSON.stringify({ inputs: prompt });
                const options = {
                    hostname: 'router.huggingface.co',
                    path: '/hf-inference/models/black-forest-labs/FLUX.1-schnell',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body),
                    },
                };

                const req = https.request(options, res => {
                    const chunks = [];
                    res.on('data', c => chunks.push(c));
                    res.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        if (res.statusCode === 200 && buffer.length > 5000) {
                            resolve(buffer);
                        } else if (res.statusCode === 402) {
                            console.log(`  [FLUX] Token ${i + 1} quota exhausted`);
                            resolve(null);
                        } else {
                            console.log(`  [FLUX] Token ${i + 1} error: HTTP ${res.statusCode}`);
                            resolve(null);
                        }
                    });
                });

                req.on('error', (e) => { console.log(`  [FLUX] Error: ${e.message}`); resolve(null); });
                req.setTimeout(120000, () => { req.destroy(); resolve(null); });
                req.write(body);
                req.end();
            });

            if (result) {
                fs.writeFileSync(imagePath, result);
                console.log(`  [FLUX] OK: ${slug}.jpg (${result.length} bytes)`);
                return `/artigos/img/${slug}.jpg`;
            }
        } catch(e) {
            console.log(`  [FLUX] Error: ${e.message}`);
        }
    }

    console.log('  [FLUX] All tokens failed, no image generated');
    return null;
}

function generateSlug(title) {
    return title
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60);
}

function generateArticlePage(article) {
    const dateFormatted = article.pubDate
        ? new Date(article.pubDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

    const paragraphs = article.rewrittenText
        .split(/\n\n|\n/)
        .filter(p => p.trim())
        .map(p => `<p>${p.trim()}</p>`)
        .join('\n                    ');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${article.rewrittenText.substring(0, 155).replace(/"/g, '&quot;')}">
    <meta name="robots" content="noindex, nofollow">
    <meta property="og:title" content="${article.rewrittenTitle.replace(/"/g, '&quot;')}">
    <meta property="og:description" content="${article.rewrittenText.substring(0, 155).replace(/"/g, '&quot;')}">
    <meta property="og:type" content="article">
    ${article.image ? `<meta property="og:image" content="${article.image}">` : ''}
    <title>${article.rewrittenTitle} - Papo de Bola</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css?v=5">
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
        @media (max-width: 768px) {
            .article-title { font-size: 24px; }
            .article-content p { font-size: 16px; }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-top">
            <div class="container">
                <div class="header-top-content">
                    <div class="logo">
                        <a href="../index.html">
                            <i class="fas fa-futbol logo-icon"></i>
                            <span class="logo-text">PAPO<span class="logo-accent">DE BOLA</span></span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <nav class="main-nav">
            <div class="container">
                <ul class="nav-list">
                    <li class="nav-item"><a href="../index.html" class="nav-link"><i class="fas fa-home"></i> Início</a></li>
                    <li class="nav-item"><a href="ao-vivo.html" class="nav-link live-link"><span class="live-dot"></span> AO VIVO</a></li>
                </ul>
            </div>
        </nav>
    </header>

    <main>
        <section class="article-hero">
            <div class="container">
                <a href="../index.html" class="article-back"><i class="fas fa-arrow-left"></i> Voltar</a>
                ${article.image ? `<img src="${article.image}" alt="${article.rewrittenTitle}" loading="lazy" onerror="this.style.display='none'">` : ''}
                <div class="article-category"><i class="fas fa-futbol"></i> Futebol Brasileiro</div>
                <h1 class="article-title">${article.rewrittenTitle}</h1>
                <div class="article-meta">
                    <span><i class="fas fa-clock"></i> ${dateFormatted}</span>
                    <span><i class="fas fa-pen"></i> Redação Papo de Bola</span>
                </div>
            </div>
        </section>

        <div class="container">
            <article class="article-content">
                    ${paragraphs}
            </article>
        </div>
    </main>

    <footer class="footer">
        <div class="container">
            <div class="footer-bottom" style="border-top:none;padding-top:0">
                <p>&copy; 2026 Papo de Bola. Todos os direitos reservados.</p>
            </div>
        </div>
    </footer>
</body>
</html>`;
}

async function main() {
    console.log('=== Building articles ===');

    // Load existing articles DB
    let existingArticles = [];
    if (fs.existsSync(ARTICLES_DB)) {
        try { existingArticles = JSON.parse(fs.readFileSync(ARTICLES_DB, 'utf8')); }
        catch(e) { existingArticles = []; }
    }
    const existingTitles = new Set(existingArticles.map(a => a.originalTitle));

    // Fetch RSS feeds
    const feeds = [
        { url: 'https://www.gazetaesportiva.com/feed/', source: 'Gazeta Esportiva' },
        { url: 'https://www.torcedores.com/feed', source: 'Torcedores' },
    ];

    const newArticles = [];

    for (const feed of feeds) {
        console.log(`\nFetching: ${feed.source}...`);
        const xml = await fetchURL(feed.url);
        if (!xml || !xml.includes('<item>')) {
            console.log('  No data');
            continue;
        }

        const items = parseRSS(xml);
        console.log(`  Found ${items.length} articles`);

        // Process only new articles (max 5 per feed per run)
        let processed = 0;
        for (const item of items) {
            if (processed >= 5) break;
            if (existingTitles.has(item.title)) continue;
            if (!item.title || item.fullText.length < 100) continue;

            console.log(`  Rewriting: ${item.title.substring(0, 60)}...`);

            const rewritten = await rewriteWithClaude(item.title, item.fullText);
            const slug = generateSlug(rewritten.title);

            // Generate image with FLUX
            console.log(`  Generating image...`);
            const imagePrompt = await generateImagePrompt(rewritten.title);
            const localImage = await generateFluxImage(imagePrompt, slug);

            const article = {
                originalTitle: item.title,
                rewrittenTitle: rewritten.title,
                rewrittenText: rewritten.text,
                slug,
                source: feed.source,
                image: localImage || '',
                pubDate: item.pubDate,
                createdAt: new Date().toISOString(),
                url: `/artigos/${slug}.html`,
            };

            // Generate HTML page
            const html = generateArticlePage(article);
            fs.writeFileSync(path.join(ARTICLES_DIR, `${slug}.html`), html);
            console.log(`  OK: ${slug}.html`);

            newArticles.push(article);
            existingTitles.add(item.title);
            processed++;
        }
    }

    // Merge and save articles DB (keep last 50)
    const allArticles = [...newArticles, ...existingArticles].slice(0, 50);
    fs.writeFileSync(ARTICLES_DB, JSON.stringify(allArticles, null, 2));

    // Update home.json with local article links
    const homeFile = path.join(CACHE_DIR, 'home.json');
    if (fs.existsSync(homeFile)) {
        const homeData = JSON.parse(fs.readFileSync(homeFile, 'utf8'));
        homeData.news = allArticles.slice(0, 15).map(a => ({
            title: a.rewrittenTitle,
            link: a.url,
            description: a.rewrittenText.substring(0, 200),
            pubDate: a.pubDate,
            image: a.image,
            local: true,
        }));
        fs.writeFileSync(homeFile, JSON.stringify(homeData));
        console.log(`\nUpdated home.json with ${homeData.news.length} local articles`);
    }

    console.log(`\nDone! ${newArticles.length} new articles created, ${allArticles.length} total`);
}

main().catch(console.error);
