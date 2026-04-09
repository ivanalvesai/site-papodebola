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
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            messages: [{
                role: 'user',
                content: `Você é um jornalista esportivo brasileiro experiente, com estilo editorial de portal profissional como ge.globo.com. Sua tarefa é criar um ARTIGO COMPLETO E EXTENSO baseado na notícia abaixo.

REGRAS OBRIGATÓRIAS:
- MÍNIMO ABSOLUTO de 2000 palavras (artigos com menos de 2000 palavras são REJEITADOS e descartados)
- Reescreva TUDO com suas próprias palavras, NUNCA copie frases do original
- Mantenha informações factuais: nomes de jogadores, times, placares, datas
- Use português do Brasil fluente e natural
- Estruture em 8-12 parágrafos densos e bem desenvolvidos
- Inclua: contexto histórico, análise tática, opinião editorial, projeções futuras
- Cada parágrafo deve ter 4-6 frases completas
- Crie subtítulos internos usando texto em maiúsculas no início do parágrafo (ex: "O CONTEXTO DA PARTIDA -")
- Inclua estatísticas, comparações com jogos anteriores e citações contextualizadas
- Termine com um parágrafo de projeção/análise do que vem pela frente

TÍTULO: Crie um título impactante, direto e jornalístico (máximo 80 caracteres)

Título original: ${title}

Texto base: ${text}

Responda APENAS no formato JSON válido:
{"title": "título aqui", "text": "texto completo com parágrafos separados por \\n\\n"}`
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
                    const stopReason = response.stop_reason;
                    console.log(`  [CLAUDE] Stop: ${stopReason}, Output tokens: ${response.usage?.output_tokens || '?'}`);

                    // Extract JSON from response
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        const wordCount = (parsed.text || '').split(/\s+/).length;
                        console.log(`  [CLAUDE] Word count: ${wordCount}`);
                        resolve({ title: parsed.title || title, text: parsed.text || text });
                    } else {
                        console.log('  [WARN] No JSON found in response');
                        resolve({ title, text });
                    }
                } catch(e) {
                    console.log('  [WARN] Claude parse error:', e.message);
                    resolve({ title, text });
                }
            });
        });

        req.on('error', (e) => { console.log('  [WARN] Request error:', e.message); resolve({ title, text }); });
        req.setTimeout(120000, () => { console.log('  [WARN] Request timeout 120s'); req.destroy(); resolve({ title, text }); });
        req.write(body);
        req.end();
    });
}

// Map team names to AllSportsApi team IDs
const TEAM_IDS = {
    'corinthians': 1957, 'palmeiras': 1963, 'flamengo': 5981,
    'são paulo': 1981, 'santos': 1968, 'vasco': 1952,
    'fluminense': 1961, 'botafogo': 1958, 'grêmio': 1954,
    'internacional': 1959, 'atlético mineiro': 1977, 'atlético-mg': 1977,
    'cruzeiro': 1982, 'bahia': 1955, 'fortaleza': 1962,
    'athletico': 1967, 'coritiba': 1999, 'bragantino': 1998,
    'cuiabá': 7315, 'goiás': 1960, 'américa-mg': 1973,
    'real madrid': 2829, 'barcelona': 2817, 'manchester': 17,
};

function detectTeamId(title) {
    const lower = title.toLowerCase();
    for (const [name, id] of Object.entries(TEAM_IDS)) {
        if (lower.includes(name)) return { id, name };
    }
    return null;
}

// Download a real match thumbnail from the team's media
async function fetchRealTeamImage(teamId, teamName, slug) {
    const imagePath = path.join(IMAGES_DIR, `${slug}.jpg`);

    // Skip if already exists
    if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 5000) {
        console.log(`  [CACHED] ${slug}.jpg`);
        return `/artigos/img/${slug}.jpg`;
    }

    console.log(`  [PHOTO] Fetching real match photos for ${teamName} (ID: ${teamId})...`);

    // Get team media from AllSportsApi
    const data = await new Promise((resolve) => {
        https.get(`https://allsportsapi2.p.rapidapi.com/api/team/${teamId}/media`, {
            headers: {
                'x-rapidapi-key': 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2',
                'x-rapidapi-host': 'allsportsapi2.p.rapidapi.com',
            },
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
        }).on('error', () => resolve(null));
    });
    if (!data?.media) {
        console.log(`  [PHOTO] No media found`);
        return null;
    }

    // Find video highlights with thumbnails (type 6 = video)
    const videos = data.media.filter(m => m.mediaType === 6 && m.thumbnailUrl);
    if (videos.length === 0) {
        console.log(`  [PHOTO] No video thumbnails found`);
        return null;
    }

    // Pick a random thumbnail to avoid all articles having the same image
    const pick = videos[Math.floor(Math.random() * Math.min(videos.length, 5))];

    // Use maxresdefault for higher quality
    let thumbUrl = pick.thumbnailUrl;
    if (thumbUrl.includes('hqdefault')) {
        thumbUrl = thumbUrl.replace('hqdefault', 'maxresdefault');
    }

    console.log(`  [PHOTO] Downloading: ${thumbUrl.substring(0, 60)}...`);

    // Download the thumbnail
    const imageData = await new Promise((resolve) => {
        const proto = thumbUrl.startsWith('https') ? https : http;
        proto.get(thumbUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            // If maxresdefault fails (404), fallback to hqdefault
            if (res.statusCode !== 200) {
                const fallback = thumbUrl.replace('maxresdefault', 'hqdefault');
                console.log(`  [PHOTO] Fallback to hqdefault...`);
                proto.get(fallback, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res2 => {
                    const chunks = [];
                    res2.on('data', c => chunks.push(c));
                    res2.on('end', () => resolve(Buffer.concat(chunks)));
                }).on('error', () => resolve(null));
                res.resume(); // consume original response
                return;
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', () => resolve(null));
    });

    if (imageData && imageData.length > 3000) {
        fs.writeFileSync(imagePath, imageData);
        console.log(`  [PHOTO] OK: ${slug}.jpg (${imageData.length} bytes) - Real match photo!`);
        return `/artigos/img/${slug}.jpg`;
    }

    console.log(`  [PHOTO] Download failed`);
    return null;
}

// Fallback: fetch a generic football image from Pexels
async function fetchPexelsImage(query, slug) {
    const imagePath = path.join(IMAGES_DIR, `${slug}.jpg`);
    if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 5000) return `/artigos/img/${slug}.jpg`;

    const PEXELS_KEY = process.env.PEXELS_API_KEY || 'pA489YWSRdWCzthnsvcu9tOeHgoWtKku4JeyxUvMGhrRVfiqYDkRo0m9';
    const searchQuery = encodeURIComponent(`futebol ${query}`);

    console.log(`  [PEXELS] Searching: futebol ${query}...`);

    const data = await new Promise((resolve) => {
        https.get(`https://api.pexels.com/v1/search?query=${searchQuery}&per_page=5&orientation=landscape`, {
            headers: { 'Authorization': PEXELS_KEY },
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
        }).on('error', () => resolve(null));
    });

    if (!data?.photos?.length) {
        console.log(`  [PEXELS] No results`);
        return null;
    }

    const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
    const photoUrl = photo.src?.large || photo.src?.medium;

    if (!photoUrl) return null;

    const imageData = await new Promise((resolve) => {
        https.get(photoUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                https.get(res.headers.location, res2 => {
                    const chunks = [];
                    res2.on('data', c => chunks.push(c));
                    res2.on('end', () => resolve(Buffer.concat(chunks)));
                }).on('error', () => resolve(null));
                res.resume();
                return;
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', () => resolve(null));
    });

    if (imageData && imageData.length > 3000) {
        fs.writeFileSync(imagePath, imageData);
        console.log(`  [PEXELS] OK: ${slug}.jpg (${imageData.length} bytes)`);
        return `/artigos/img/${slug}.jpg`;
    }

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
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
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

        // Process only new articles (max 3 per feed per run - each article is 2000+ words)
        let processed = 0;
        for (const item of items) {
            if (processed >= 3) break;
            if (existingTitles.has(item.title)) continue;
            if (!item.title || item.fullText.length < 100) continue;

            console.log(`  Rewriting: ${item.title.substring(0, 60)}...`);

            const rewritten = await rewriteWithClaude(item.title, item.fullText);

            // Validate minimum word count
            const wordCount = (rewritten.text || '').split(/\s+/).filter(w => w.length > 0).length;
            if (wordCount < 1500) {
                console.log(`  [REJECTED] Only ${wordCount} words (min 1500). Skipping.`);
                continue;
            }

            const slug = generateSlug(rewritten.title);

            // Get real match image
            console.log(`  Finding image...`);
            const team = detectTeamId(rewritten.title) || detectTeamId(item.title);
            let localImage = null;

            // 1st: Try real match thumbnail from team media
            if (team) {
                localImage = await fetchRealTeamImage(team.id, team.name, slug);
            }

            // 2nd: Fallback to Pexels free stock photo
            if (!localImage) {
                const searchTerm = team ? team.name : 'match stadium';
                localImage = await fetchPexelsImage(searchTerm, slug);
            }

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
