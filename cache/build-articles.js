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
                content: `Você é um jornalista esportivo brasileiro experiente e autêntico. Escreva como um ser humano real, com personalidade, opiniões e estilo próprio. Sua tarefa é criar um ARTIGO COMPLETO baseado na notícia abaixo.

IMPORTANTE: O texto original pode estar em QUALQUER idioma (inglês, espanhol, etc). Você DEVE escrever o artigo INTEIRO em PORTUGUÊS DO BRASIL. Traduza e reescreva tudo. O título também DEVE ser em português.

REGRAS DE CONTEÚDO:
- Escreva um artigo LONGO e COMPLETO, idealmente com 2000+ palavras
- Reescreva e TRADUZA tudo para português do Brasil
- NUNCA deixe palavras, frases ou títulos em inglês/espanhol
- Mantenha informações factuais: nomes de jogadores, times, placares, datas
- Use português do Brasil fluente, coloquial mas profissional
- Estruture em 8-12 parágrafos densos
- Inclua: contexto, análise tática, opinião pessoal, projeções
- Crie subtítulos internos em maiúsculas (ex: "O CONTEXTO DA PARTIDA -")

REGRAS DE HUMANIZAÇÃO (CRÍTICO - siga à risca):
- NUNCA use estas palavras/expressões de IA: "crucial", "pivotal", "landscape", "tapestry", "testament", "fostering", "showcasing", "delve", "underscores", "highlights the importance", "vibrant", "profound", "groundbreaking", "nestled", "in the heart of", "broader implications", "it is worth noting", "sets the stage", "indelible mark"
- NUNCA use a estrutura "Não é apenas X, mas também Y"
- NUNCA use 3 adjetivos seguidos (regra dos três)
- NUNCA use travessão (—) mais de 1 vez no texto inteiro
- NUNCA comece parágrafos consecutivos com a mesma estrutura
- VARIE o tamanho das frases: misture frases curtas e diretas com frases mais longas
- TENHA OPINIÃO: não seja neutro, reaja aos fatos. "Difícil engolir esse resultado" é melhor que "o resultado foi desfavorável"
- USE PRIMEIRA PESSOA quando fizer sentido: "confesso que não esperava", "me parece que"
- SEJA ESPECÍFICO: em vez de "os torcedores ficaram insatisfeitos", diga "a torcida vaiou por 5 minutos após o apito final"
- NÃO USE voz passiva excessivamente. Prefira "o Palmeiras venceu" a "a vitória foi conquistada pelo Palmeiras"
- EVITE começar frases com "Além disso", "Adicionalmente", "É importante ressaltar", "Vale destacar"
- INCLUA detalhes sensoriais: barulho da torcida, clima do estádio, tensão nos acréscimos
- ESCREVA como se estivesse contando para um amigo no bar que manja de futebol

TÍTULO: Direto, sem floreios, máximo 80 caracteres. Nada de "a saga", "o destino", "a jornada".

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
    // Brasil
    'corinthians': 1957, 'palmeiras': 1963, 'flamengo': 5981,
    'são paulo': 1981, 'santos': 1968, 'vasco': 1974,
    'fluminense': 1961, 'botafogo': 1958, 'grêmio': 5926,
    'internacional': 1966, 'atlético mineiro': 1977, 'atlético-mg': 1977,
    'cruzeiro': 1954, 'bahia': 1955, 'fortaleza': 2020,
    'athletico': 1967, 'coritiba': 1982, 'bragantino': 1999,
    'cuiabá': 49202, 'goiás': 1960, 'américa-mg': 1973,
    // Premier League
    'liverpool': 44, 'arsenal': 42, 'manchester city': 17,
    'manchester united': 35, 'chelsea': 38, 'tottenham': 33,
    'spurs': 33, 'newcastle': 39, 'aston villa': 40,
    'nottingham forest': 174, 'west ham': 37, 'brighton': 30,
    // La Liga
    'real madrid': 2829, 'barcelona': 2817, 'atlético de madrid': 2836,
    'atletico madrid': 2836,
    // Serie A
    'juventus': 2687, 'milan': 2692, 'inter de milão': 2697,
    'inter milan': 2697, 'napoli': 2714, 'roma': 2702, 'lazio': 2699,
    // Bundesliga
    'bayern': 2672, 'dortmund': 2673, 'leverkusen': 2681,
    'borussia dortmund': 2673, 'bayer leverkusen': 2681,
    // Ligue 1
    'psg': 1644, 'paris saint-germain': 1644, 'marseille': 1641, 'lyon': 1649,
    // Portugal
    'porto': 3002, 'benfica': 3004, 'sporting': 3005,
    // Outros
    'river plate': 3211, 'boca juniors': 3212,
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

    console.log(`  [PEXELS] Searching: ${query}...`);

    const data = await new Promise((resolve) => {
        https.get(`https://api.pexels.com/v1/search?query=${searchQuery}&per_page=10&orientation=landscape`, {
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

// Use shared article template
const { generateArticleHTML } = require(path.join(__dirname, '..', 'api', 'article-template.js'));
function generateArticlePage(article) { return generateArticleHTML(article); }

// Auto-detect category and team tags from article text
const TEAMS_MAP = {
    'palmeiras': { name: 'Palmeiras', slug: 'palmeiras' },
    'flamengo': { name: 'Flamengo', slug: 'flamengo' },
    'corinthians': { name: 'Corinthians', slug: 'corinthians' },
    'são paulo': { name: 'São Paulo', slug: 'sao-paulo' },
    'santos': { name: 'Santos', slug: 'santos' },
    'fluminense': { name: 'Fluminense', slug: 'fluminense' },
    'botafogo': { name: 'Botafogo', slug: 'botafogo' },
    'vasco': { name: 'Vasco', slug: 'vasco' },
    'grêmio': { name: 'Grêmio', slug: 'gremio' },
    'internacional': { name: 'Internacional', slug: 'internacional' },
    'atlético mineiro': { name: 'Atlético-MG', slug: 'atletico-mg' },
    'atlético-mg': { name: 'Atlético-MG', slug: 'atletico-mg' },
    'cruzeiro': { name: 'Cruzeiro', slug: 'cruzeiro' },
    'bahia': { name: 'Bahia', slug: 'bahia' },
    'fortaleza': { name: 'Fortaleza', slug: 'fortaleza' },
    'athletico': { name: 'Athletico-PR', slug: 'athletico-pr' },
    'coritiba': { name: 'Coritiba', slug: 'coritiba' },
    'bragantino': { name: 'Bragantino', slug: 'bragantino' },
    'real madrid': { name: 'Real Madrid', slug: 'real-madrid' },
    'barcelona': { name: 'Barcelona', slug: 'barcelona' },
    'liverpool': { name: 'Liverpool', slug: 'liverpool' },
    'manchester city': { name: 'Manchester City', slug: 'manchester-city' },
    'manchester united': { name: 'Manchester United', slug: 'manchester-united' },
    'juventus': { name: 'Juventus', slug: 'juventus' },
    'milan': { name: 'Milan', slug: 'milan' },
    'psg': { name: 'PSG', slug: 'psg' },
    'bayern': { name: 'Bayern', slug: 'bayern' },
};

const COMPETITIONS_MAP = {
    // Priority order: most specific first
    'copa do mundo': 'Copa do Mundo',
    'world cup': 'Copa do Mundo',
    'mundial 2026': 'Copa do Mundo',
    'eliminatórias': 'Eliminatórias',
    'copa américa': 'Copa América',
    'seleção brasileira': 'Seleção Brasileira',
    'seleção': 'Seleção Brasileira',
    'copa do brasil': 'Copa do Brasil',
    'libertadores': 'Copa Libertadores',
    'sudamericana': 'Copa Sudamericana',
    'champions league': 'Champions League',
    'premier league': 'Premier League',
    'la liga': 'La Liga',
    'bundesliga': 'Bundesliga',
    'ligue 1': 'Ligue 1',
    'brasileirão': 'Brasileirão',
    'série a': 'Brasileirão',
    'série b': 'Brasileirão Série B',
    // Outros esportes
    'nba': 'NBA', 'basquete': 'NBA', 'basketball': 'NBA', 'lakers': 'NBA', 'celtics': 'NBA', 'warriors': 'NBA', 'nbb': 'NBA',
    'tênis': 'Tênis', 'tenis': 'Tênis', 'tennis': 'Tênis', 'atp': 'Tênis', 'wta': 'Tênis', 'grand slam': 'Tênis',
    'roland garros': 'Tênis', 'wimbledon': 'Tênis', 'us open': 'Tênis', 'australian open': 'Tênis',
    'joão fonseca': 'Tênis', 'joao fonseca': 'Tênis', 'djokovic': 'Tênis', 'alcaraz': 'Tênis', 'sinner': 'Tênis', 'nadal': 'Tênis',
    'fórmula 1': 'Fórmula 1', 'formula 1': 'Fórmula 1', 'f1': 'Fórmula 1', 'verstappen': 'Fórmula 1', 'hamilton': 'Fórmula 1', 'leclerc': 'Fórmula 1',
    'red bull racing': 'Fórmula 1', 'ferrari f1': 'Fórmula 1', 'mclaren': 'Fórmula 1', 'mercedes f1': 'Fórmula 1',
    'ufc': 'MMA', 'mma': 'MMA', 'bellator': 'MMA', 'octagon': 'MMA', 'dana white': 'MMA',
    'vôlei': 'Vôlei', 'volei': 'Vôlei', 'volleyball': 'Vôlei', 'superliga': 'Vôlei',
    'esports': 'eSports', 'e-sports': 'eSports', 'cs2': 'eSports', 'counter-strike': 'eSports', 'valorant': 'eSports',
    'league of legends': 'eSports', 'lol': 'eSports', 'dota': 'eSports', 'cblol': 'eSports',
    'nfl': 'NFL', 'super bowl': 'NFL', 'touchdown': 'NFL', 'quarterback': 'NFL', 'american football': 'NFL',
    'mlb': 'MLB', 'baseball': 'MLB', 'beisebol': 'MLB',
    'nhl': 'NHL', 'hockey': 'NHL', 'hóquei': 'NHL',
    'futsal': 'Futsal',
    'handebol': 'Handebol', 'handball': 'Handebol',
};

function detectCategoryAndTags(text) {
    const lower = text.toLowerCase();
    const tags = [];
    let mainTeam = null;
    let category = 'Futebol Brasileiro';

    // Detect teams (first found = main team)
    for (const [key, team] of Object.entries(TEAMS_MAP)) {
        if (lower.includes(key)) {
            tags.push(team.slug);
            if (!mainTeam) mainTeam = team.slug;
        }
    }

    // Detect competition
    for (const [key, comp] of Object.entries(COMPETITIONS_MAP)) {
        if (lower.includes(key)) {
            category = comp;
            break;
        }
    }

    // If international team but no competition detected
    const intlTeams = ['real-madrid','barcelona','liverpool','manchester-city','manchester-united','juventus','milan','psg','bayern'];
    if (mainTeam && intlTeams.includes(mainTeam) && category === 'Futebol Brasileiro') {
        category = 'Futebol Internacional';
    }

    return { category, tags: [...new Set(tags)], mainTeam };
}

// WordPress REST API publishing
const WP_BASE = 'https://admin.papodebola.com.br/wp-json/wp/v2';
const WP_USER = 'ivanalves';
const WP_APP_PASS = 'HeYF 49xY pg73 dhQi 5zZq 4B6K';
const WP_AUTH = 'Basic ' + Buffer.from(`${WP_USER}:${WP_APP_PASS}`).toString('base64');

// Cache WP categories
let wpCategories = null;
async function getWPCategoryId(name) {
    if (!wpCategories) {
        wpCategories = await new Promise((resolve) => {
            https.get(`${WP_BASE}/categories?per_page=50`, {
                headers: { 'Authorization': WP_AUTH },
                rejectUnauthorized: false,
            }, res => {
                let d = '';
                res.on('data', c => d += c);
                res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
            }).on('error', () => resolve([]));
        });
    }
    const cat = wpCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
    return cat?.id || 1; // 1 = Uncategorized
}

// Generate focus keyword from title (3 words, no stop words)
function generateFocusKeyword(title) {
    const stop = ['para','com','que','por','mais','como','sobre','entre','pela','uma','dos','das','nos','nas','mas','pode','tem','vai','sem','foi','ainda','após','não','são','está','seu','sua','ele','ela'];
    const words = title.toLowerCase()
        .replace(/[^\w\sáéíóúâêôãõçü-]/gi, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stop.includes(w));
    return words.slice(0, 3).join(' ');
}

// Generate SEO-optimized slug (< 55 chars)
function generateSEOSlug(title) {
    let slug = title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    if (slug.length > 55) {
        slug = slug.substring(0, 55);
        const last = slug.lastIndexOf('-');
        if (last > 30) slug = slug.substring(0, last);
    }
    return slug;
}

async function publishToWordPress(article) {
    const categoryId = await getWPCategoryId(article.category || 'Futebol Brasileiro');
    const focusKW = generateFocusKeyword(article.rewrittenTitle);
    const slug = generateSEOSlug(article.rewrittenTitle);
    const plainText = (article.rewrittenText || '').substring(0, 200);

    // Format content as HTML with H2 headings, KW density, and internal links
    let paragraphs = (article.rewrittenText || '')
        .split(/\n\n|\n/)
        .filter(p => p.trim());

    // Convert bold subtitles to H2
    let htmlParts = paragraphs.map(p => {
        let text = p.trim();
        const h2Match = text.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇÜ][A-ZÁÉÍÓÚÂÊÔÃÕÇÜ\s,]{4,})\s*[-–—:]\s*(.*)/);
        if (h2Match) {
            return `<h2>${h2Match[1]}</h2>\n<p>${h2Match[2]}</p>`;
        }
        return `<p>${text}</p>`;
    });

    // Insert KW in first paragraph if missing
    const firstParaLower = htmlParts[0]?.toLowerCase() || '';
    if (!firstParaLower.includes(focusKW)) {
        htmlParts[0] = htmlParts[0].replace('<p>', `<p>${focusKW.charAt(0).toUpperCase() + focusKW.slice(1)} — `);
    }

    // Boost KW density: add KW naturally every ~5 paragraphs
    const targetOccurrences = Math.max(5, Math.ceil(paragraphs.length * 0.3));
    let kwCount = htmlParts.join(' ').toLowerCase().split(focusKW).length - 1;
    const variations = [
        `Sobre ${focusKW}, vale acompanhar os próximos capítulos.`,
        `O cenário envolvendo ${focusKW} segue em evolução.`,
        `A situação de ${focusKW} merece atenção dos torcedores.`,
    ];
    for (let i = 3; i < htmlParts.length && kwCount < targetOccurrences; i += 4) {
        if (htmlParts[i] && htmlParts[i].includes('<p>')) {
            htmlParts[i] = htmlParts[i].replace('</p>', ` ${variations[kwCount % variations.length]}</p>`);
            kwCount++;
        }
    }

    // Add TOC if 3+ headings
    const h2Count = htmlParts.filter(p => p.includes('<h2')).length;
    if (h2Count >= 3) {
        const tocItems = [];
        let sectionIdx = 0;
        htmlParts = htmlParts.map(p => {
            const m = p.match(/<h2>(.*?)<\/h2>/);
            if (m) {
                const anchor = `section-${sectionIdx}`;
                tocItems.push(`<li><a href="#${anchor}">${m[1]}</a></li>`);
                p = p.replace('<h2>', `<h2 id="${anchor}">`);
                sectionIdx++;
            }
            return p;
        });
        const toc = `<div style="background:#f8f9fa;border:1px solid #e2e5e9;border-radius:8px;padding:16px 20px;margin:20px 0"><strong>Neste artigo:</strong><ul style="margin:8px 0 0;padding-left:20px">${tocItems.join('')}</ul></div>`;
        // Insert after first paragraph
        htmlParts.splice(1, 0, toc);
    }

    // Add external link (authoritative source)
    const extLinks = {
        'Brasileirão': ['https://www.cbf.com.br/', 'CBF'],
        'Copa Libertadores': ['https://www.conmebol.com/', 'CONMEBOL'],
        'Champions League': ['https://www.uefa.com/', 'UEFA'],
        'Premier League': ['https://www.premierleague.com/', 'Premier League'],
        'Copa do Mundo': ['https://www.fifa.com/', 'FIFA'],
        'Futebol Internacional': ['https://www.uefa.com/', 'UEFA'],
        'Copa do Brasil': ['https://www.cbf.com.br/', 'CBF'],
        'NBA': ['https://www.nba.com/', 'NBA'],
        'Basquete': ['https://www.nba.com/', 'NBA'],
        'Tênis': ['https://www.atptour.com/', 'ATP Tour'],
        'Fórmula 1': ['https://www.formula1.com/', 'Formula 1'],
        'MMA': ['https://www.ufc.com/', 'UFC'],
        'Vôlei': ['https://www.fivb.com/', 'FIVB'],
        'eSports': ['https://www.hltv.org/', 'HLTV'],
        'NFL': ['https://www.nfl.com/', 'NFL'],
        'MLB': ['https://www.mlb.com/', 'MLB'],
        'NHL': ['https://www.nhl.com/', 'NHL'],
        'Seleção Brasileira': ['https://www.cbf.com.br/', 'CBF'],
    };
    const ext = extLinks[article.category] || ['https://www.cbf.com.br/', 'CBF'];
    htmlParts.push(`<p><em>Fonte oficial: <a href="${ext[0]}" target="_blank" rel="noopener">${ext[1]}</a></em></p>`);

    const htmlContent = htmlParts.join('\n');

    // SEO meta
    const seoTitle = article.rewrittenTitle.length > 50
        ? article.rewrittenTitle.substring(0, 47) + '... | Papo de Bola'
        : article.rewrittenTitle + ' | Papo de Bola';

    const metaDesc = `${focusKW.charAt(0).toUpperCase() + focusKW.slice(1)}: ${plainText.substring(0, 120)}. Leia mais!`;

    // Secondary keywords from tags
    const secondaryKW = (article.tags || []).slice(0, 3).join(',');
    const allKW = secondaryKW ? `${focusKW},${secondaryKW}` : focusKW;

    const postData = JSON.stringify({
        title: article.rewrittenTitle,
        content: htmlContent,
        status: 'publish',
        slug: slug,
        categories: [categoryId],
        excerpt: plainText,
        meta: {
            rank_math_focus_keyword: allKW,
            rank_math_title: seoTitle,
            rank_math_description: metaDesc,
            rank_math_rich_snippet: 'article',
            rank_math_snippet_article_type: 'NewsArticle',
            rank_math_robots: ['index', 'follow', 'max-snippet:-1', 'max-image-preview:large'],
            rank_math_facebook_title: seoTitle,
            rank_math_facebook_description: metaDesc,
            rank_math_twitter_use_facebook: 'on',
        },
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'admin.papodebola.com.br',
            path: '/wp-json/wp/v2/posts',
            method: 'POST',
            headers: {
                'Authorization': WP_AUTH,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
            rejectUnauthorized: false,
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const post = JSON.parse(data);
                    if (post.id) {
                        // Upload featured image if available
                        if (article.image && article.image.startsWith('/artigos/img/')) {
                            const imgPath = path.join(__dirname, '..', article.image);
                            if (fs.existsSync(imgPath)) {
                                uploadFeaturedImage(post.id, imgPath, article.slug + '.jpg', article.rewrittenTitle);
                            }
                        }
                        // Add internal links
                        addInternalLinks(post.id, categoryId);
                        resolve(post.link || `Post #${post.id}`);
                    } else {
                        console.log(`  [WP] Error: ${post.message || 'unknown'}`);
                        resolve(null);
                    }
                } catch { resolve(null); }
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(30000, () => { req.destroy(); resolve(null); });
        req.write(postData);
        req.end();
    });
}

// Upload featured image to WordPress and set as post thumbnail
function uploadFeaturedImage(postId, imagePath, filename, altText) {
    const imageData = fs.readFileSync(imagePath);

    const uploadReq = https.request({
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
    }, uploadRes => {
        let d = '';
        uploadRes.on('data', c => d += c);
        uploadRes.on('end', () => {
            try {
                const media = JSON.parse(d);
                if (media.id) {
                    // Set as featured image
                    const updateData = JSON.stringify({ featured_media: media.id });
                    const setReq = https.request({
                        hostname: 'admin.papodebola.com.br',
                        path: `/wp-json/wp/v2/posts/${postId}`,
                        method: 'PUT',
                        headers: {
                            'Authorization': WP_AUTH,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(updateData),
                        },
                        rejectUnauthorized: false,
                    }, () => {});
                    setReq.on('error', () => {});
                    setReq.write(updateData);
                    setReq.end();

                    // Set alt text
                    const altData = JSON.stringify({ alt_text: altText + ' - Papo de Bola' });
                    const altReq = https.request({
                        hostname: 'admin.papodebola.com.br',
                        path: `/wp-json/wp/v2/media/${media.id}`,
                        method: 'PUT',
                        headers: {
                            'Authorization': WP_AUTH,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(altData),
                        },
                        rejectUnauthorized: false,
                    }, () => {});
                    altReq.on('error', () => {});
                    altReq.write(altData);
                    altReq.end();

                    console.log(`  [WP] Featured image #${media.id} set for post #${postId}`);
                }
            } catch {}
        });
    });
    uploadReq.on('error', () => {});
    uploadReq.setTimeout(60000, () => uploadReq.destroy());
    uploadReq.write(imageData);
    uploadReq.end();
}

// Add "Leia também" internal links section to a post
async function addInternalLinks(postId, categoryId) {
    // Get related posts from same category
    const related = await new Promise((resolve) => {
        https.get(`${WP_BASE}/posts?categories=${categoryId}&exclude=${postId}&per_page=3&orderby=date&order=desc`, {
            headers: { 'Authorization': WP_AUTH },
            rejectUnauthorized: false,
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
        }).on('error', () => resolve([]));
    });

    if (!related || related.length === 0) return;

    // Get current content
    const post = await new Promise((resolve) => {
        https.get(`${WP_BASE}/posts/${postId}`, {
            headers: { 'Authorization': WP_AUTH },
            rejectUnauthorized: false,
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        }).on('error', () => resolve(null));
    });

    if (!post) return;

    let content = post.content?.raw || post.content?.rendered || '';
    if (content.includes('Leia também')) return;

    // Use PUBLIC site URLs, not WordPress admin URLs
    let links = '\n<h2>Leia também</h2>\n<ul>\n';
    related.forEach(r => {
        const publicUrl = `https://papodebola.com.br/artigos/${r.slug}.html`;
        links += `<li><a href="${publicUrl}">${r.title?.rendered || r.title}</a></li>\n`;
    });
    links += '</ul>';
    content += links;

    // Also fix any existing admin.papodebola URLs in content to public URLs
    content = content.replace(/https:\/\/admin\.papodebola\.com\.br\/([a-z0-9-]+)\//g,
        'https://papodebola.com.br/artigos/$1.html');

    // Update post
    const updateData = JSON.stringify({ content });
    const req = https.request({
        hostname: 'admin.papodebola.com.br',
        path: `/wp-json/wp/v2/posts/${postId}`,
        method: 'PUT',
        headers: {
            'Authorization': WP_AUTH,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(updateData),
        },
        rejectUnauthorized: false,
    }, () => {});
    req.on('error', () => {});
    req.write(updateData);
    req.end();
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

    // === FEED SCHEDULE ===
    // 5 futebol (fixo) + 5 esporte do dia (rotação)
    // Rotação: Tênis → NBA → F1 → MMA → Vôlei → eSports → NFL → MLB → NHL → Futsal → Handebol
    const FOOTBALL_FEEDS = [
        { url: 'https://www.torcedores.com/feed', source: 'Torcedores' },
        { url: 'https://www.terra.com.br/esportes/futebol/rss.xml', source: 'Terra Esportes' },
        { url: 'https://trivela.com.br/feed/', source: 'Trivela' },
        { url: 'https://futebolatino.com.br/feed/', source: 'Futebol Latino' },
        { url: 'https://www.meutimao.com.br/feed', source: 'Meu Timão' },
        { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', source: 'BBC Sport' },
        { url: 'https://www.theguardian.com/football/rss', source: 'The Guardian' },
    ];

    // Esportes em rotação diária (1 por dia, volta ao início após completar)
    const SPORT_ROTATION = [
        { name: 'Tênis', feeds: [
            { url: 'https://www.espn.com/espn/rss/tennis/news', source: 'ESPN Tênis' },
            { url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml', source: 'BBC Tênis' },
            { url: 'https://www.sportskeeda.com/feed', source: 'SportsKeeda' },
        ]},
        { name: 'NBA', feeds: [
            { url: 'https://www.espn.com/espn/rss/nba/news', source: 'ESPN NBA' },
            { url: 'https://www.essentiallysports.com/feed/', source: 'Essentially Sports' },
        ]},
        { name: 'Fórmula 1', feeds: [
            { url: 'https://www.formula1.com/content/fom-website/en/latest/all.xml', source: 'F1 Oficial' },
            { url: 'https://www.essentiallysports.com/feed/', source: 'Essentially Sports' },
        ]},
        { name: 'MMA', feeds: [
            { url: 'https://www.sherdog.com/rss/news.xml', source: 'Sherdog MMA' },
            { url: 'https://www.sportskeeda.com/feed', source: 'SportsKeeda' },
        ]},
        { name: 'Vôlei', feeds: [
            { url: 'https://www.sportskeeda.com/feed', source: 'SportsKeeda' },
        ]},
        { name: 'eSports', feeds: [
            { url: 'https://canaltech.com.br/rss/esports/', source: 'Canaltech eSports' },
            { url: 'https://dotesports.com/feed', source: 'Dot Esports' },
        ]},
        { name: 'NFL', feeds: [
            { url: 'https://www.sportskeeda.com/feed', source: 'SportsKeeda' },
            { url: 'https://www.essentiallysports.com/feed/', source: 'Essentially Sports' },
        ]},
        { name: 'MLB', feeds: [
            { url: 'https://www.sportskeeda.com/feed', source: 'SportsKeeda' },
        ]},
        { name: 'NHL', feeds: [
            { url: 'https://www.sportskeeda.com/feed', source: 'SportsKeeda' },
        ]},
        { name: 'Futsal', feeds: [
            { url: 'https://www.torcedores.com/feed', source: 'Torcedores' },
        ]},
        { name: 'Handebol', feeds: [
            { url: 'https://www.sportskeeda.com/feed', source: 'SportsKeeda' },
        ]},
    ];

    // Determine today's 5 sports (rotation: pick 5 consecutive from the list, shift each day)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const startIndex = (dayOfYear * 5) % SPORT_ROTATION.length;
    const todaySports = [];
    for (let i = 0; i < 5; i++) {
        todaySports.push(SPORT_ROTATION[(startIndex + i) % SPORT_ROTATION.length]);
    }

    // How many articles to publish this run (1 per cron slot, 10 slots/day)
    const maxThisRun = parseInt(process.env.MAX_ARTICLES || '10');

    console.log(`Today's sports: ${todaySports.map(s => s.name).join(', ')}`);
    console.log(`Max articles this run: ${maxThisRun}`);
    console.log('Schedule: 5 futebol + 1 de cada esporte = 10/day\n');

    // Track daily counts from articles.json
    const today = new Date().toISOString().split('T')[0];
    const todayArticles = existingArticles.filter(a => a.pubDate?.startsWith(today));
    const todayFootball = todayArticles.filter(a => {
        const cat = (a.category || '').toLowerCase();
        return cat.includes('futebol') || cat.includes('brasileir') || cat.includes('copa') || cat.includes('libertadores') || cat.includes('champions') || cat.includes('premier') || cat.includes('liga') || cat.includes('seleção') || cat.includes('mercado');
    }).length;
    const todaySportArticles = todayArticles.length - todayFootball;

    console.log(`Already today: ${todayFootball} futebol + ${todaySportArticles} esportes = ${todayArticles.length} total`);

    if (todayArticles.length >= 10) {
        console.log('Daily limit (10) reached. Skipping.');
        return;
    }

    const newArticles = [];
    const needFootball = Math.max(0, 5 - todayFootball);
    const needSport = Math.max(0, 5 - todaySportArticles);
    let published = 0;

    // Helper: process a single article
    async function processOneArticle(item, feed) {
        console.log(`  Rewriting: ${item.title.substring(0, 60)}...`);
        const rewritten = await rewriteWithClaude(item.title, item.fullText);
        const wordCount = (rewritten.text || '').split(/\s+/).filter(w => w.length > 0).length;
        console.log(`  [WORDS] ${wordCount} palavras`);

        const slug = generateSlug(rewritten.title);

        // Detect category first to know the sport
        const detected = detectCategoryAndTags(rewritten.title + ' ' + rewritten.text);
        const category = detected.category;

        // Sport API paths and fallback images
        const SPORT_CONFIG = {
            'NBA':        { api: 'basketball', fallback: 'basketball game nba court' },
            'Basquete':   { api: 'basketball', fallback: 'basketball game nba court' },
            'Tênis':      { api: 'tennis', fallback: 'tennis match court player' },
            'Fórmula 1':  { api: 'motorsport', fallback: 'formula 1 race car track' },
            'MMA':        { api: 'mma', fallback: 'mma ufc octagon fight' },
            'Vôlei':      { api: 'volleyball', fallback: 'volleyball match game' },
            'eSports':    { api: null, fallback: 'esports gaming tournament' },  // No API endpoint
            'NFL':        { api: 'american-football', fallback: 'american football nfl game' },
            'MLB':        { api: 'baseball', fallback: 'baseball mlb game stadium' },
            'NHL':        { api: 'ice-hockey', fallback: 'ice hockey nhl game' },
            'Futsal':     { api: null, fallback: 'futsal indoor football' },
            'Handebol':   { api: 'handball', fallback: 'handball match game' },
        };

        const sportConfig = SPORT_CONFIG[category];
        const isFootball = !sportConfig;

        console.log(`  Finding image... (${isFootball ? 'futebol' : category})`);
        let localImage = null;

        // 1. Try AllSportsApi - search for team/player by title keywords, get media
        const titleForSearch = (rewritten.title || item.title || '').substring(0, 80);
        const searchWords = titleForSearch.replace(/[^a-záéíóúâêôãõçüA-Z\s]/gi, '').split(/\s+/).filter(w => w.length > 3).slice(0, 2);

        if (isFootball) {
            // Football: use existing team detection
            const team = detectTeamId(rewritten.title) || detectTeamId(item.title) || detectTeamId(rewritten.text?.substring(0, 300) || '');
            if (team) localImage = await fetchRealTeamImage(team.id, team.name, slug);
        } else if (sportConfig?.api) {
            // Other sports: search API for team/player, then get media
            for (const word of searchWords) {
                if (localImage) break;
                try {
                    const searchUrl = `https://allsportsapi2.p.rapidapi.com/api/${sportConfig.api}/search/${encodeURIComponent(word)}`;
                    const searchData = await new Promise((resolve) => {
                        https.get(searchUrl, {
                            headers: { 'x-rapidapi-key': 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2', 'x-rapidapi-host': 'allsportsapi2.p.rapidapi.com' },
                            rejectUnauthorized: false,
                        }, res => {
                            let d = ''; res.on('data', c => d += c);
                            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
                        }).on('error', () => resolve(null));
                    });

                    const entity = searchData?.results?.[0]?.entity;
                    if (entity?.id) {
                        console.log(`  [API] Found: ${entity.name} (${sportConfig.api}, ID: ${entity.id})`);
                        // Get media
                        const mediaUrl = `https://allsportsapi2.p.rapidapi.com/api/${sportConfig.api}/team/${entity.id}/media`;
                        const mediaData = await new Promise((resolve) => {
                            https.get(mediaUrl, {
                                headers: { 'x-rapidapi-key': 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2', 'x-rapidapi-host': 'allsportsapi2.p.rapidapi.com' },
                                rejectUnauthorized: false,
                            }, res => {
                                let d = ''; res.on('data', c => d += c);
                                res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
                            }).on('error', () => resolve(null));
                        });

                        const videos = mediaData?.media?.filter(m => m.thumbnailUrl);
                        if (videos?.length > 0) {
                            const pick = videos[Math.floor(Math.random() * Math.min(videos.length, 5))];
                            let thumbUrl = pick.thumbnailUrl;
                            if (thumbUrl.includes('hqdefault')) thumbUrl = thumbUrl.replace('hqdefault', 'maxresdefault');

                            const imgData = await new Promise((resolve) => {
                                https.get(thumbUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
                                    if (res.statusCode !== 200) {
                                        const fb = thumbUrl.replace('maxresdefault', 'hqdefault');
                                        https.get(fb, res2 => {
                                            const ch = []; res2.on('data', c => ch.push(c));
                                            res2.on('end', () => resolve(Buffer.concat(ch)));
                                        }).on('error', () => resolve(null));
                                        res.resume(); return;
                                    }
                                    const ch = []; res.on('data', c => ch.push(c));
                                    res.on('end', () => resolve(Buffer.concat(ch)));
                                }).on('error', () => resolve(null));
                            });

                            if (imgData && imgData.length > 3000) {
                                const imgPath = path.join(IMAGES_DIR, `${slug}.jpg`);
                                fs.writeFileSync(imgPath, imgData);
                                localImage = `/artigos/img/${slug}.jpg`;
                                console.log(`  [API] Image OK: ${entity.name} (${imgData.length} bytes)`);
                            }
                        }
                    }
                } catch(e) { /* continue */ }
            }
        }

        // 2. Fallback: Pexels with title keywords + sport term
        if (!localImage) {
            const kw = searchWords.join(' ');
            if (kw) {
                const sportTerm = isFootball ? 'football' : (sportConfig?.fallback?.split(' ')[0] || 'sport');
                localImage = await fetchPexelsImage(`${kw} ${sportTerm}`, slug);
            }
        }

        // 3. Final fallback: sport-specific generic image
        if (!localImage) {
            if (isFootball) {
                const team = detectTeamId(rewritten.title) || detectTeamId(item.title);
                if (team) localImage = await fetchPexelsImage(`${team.name} football stadium`, slug);
                if (!localImage) localImage = await fetchPexelsImage('football stadium aerial view', slug);
            } else {
                localImage = await fetchPexelsImage(sportConfig?.fallback || 'sport stadium', slug);
            }
        }

        const article = {
            originalTitle: item.title,
            rewrittenTitle: rewritten.title,
            rewrittenText: rewritten.text,
            slug, source: feed.source,
            image: localImage || '',
            category: detected.category,
            tags: detected.tags,
            team: detected.mainTeam,
            pubDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            url: `/artigos/${slug}.html`,
        };

        const wpPublished = await publishToWordPress(article);
        if (wpPublished) console.log(`  [WP] Published: ${wpPublished}`);

        const html = generateArticlePage(article);
        fs.writeFileSync(path.join(ARTICLES_DIR, `${slug}.html`), html);
        console.log(`  OK: ${slug}.html`);

        newArticles.push(article);
        existingTitles.add(item.title);
    }

    // Decide what to publish: alternate football / sport
    // Odd slots (1,3,5,7,9) = football, Even slots (2,4,6,8,10) = sport
    const slotNumber = todayArticles.length + 1; // 1-10
    const isFootballSlot = slotNumber % 2 === 1 && needFootball > 0;
    const isSportSlot = slotNumber % 2 === 0 && needSport > 0;
    // If one type is full, use the other
    const publishFootball = isFootballSlot || (!isSportSlot && needFootball > 0);
    const publishSport = isSportSlot || (!isFootballSlot && needSport > 0);

    if (publishFootball && needFootball > 0 && published < maxThisRun) {
        console.log(`=== SLOT ${slotNumber}: FUTEBOL (${needFootball} restantes) ===`);
        for (const feed of FOOTBALL_FEEDS) {
            if (published >= maxThisRun) break;
            const xml = await fetchURL(feed.url);
            if (!xml || !xml.includes('<item>')) continue;
            const items = parseRSS(xml);

            for (const item of items) {
                if (published >= maxThisRun) break;
                if (existingTitles.has(item.title)) continue;
                if (!item.title || item.fullText.length < 100) continue;
                await processOneArticle(item, feed);
                published++;
                break;
            }
            if (published > 0) break;
        }
    }

    if (publishSport && needSport > 0 && published < maxThisRun) {
        // Pick the sport for this slot
        const sportIndex = Math.floor(todaySportArticles) % todaySports.length;
        const sport = todaySports[sportIndex];
        console.log(`=== SLOT ${slotNumber}: ${sport.name.toUpperCase()} ===`);

        for (const feed of sport.feeds) {
            if (published >= maxThisRun) break;
            const xml = await fetchURL(feed.url);
            if (!xml || !xml.includes('<item>')) continue;
            const items = parseRSS(xml);

            for (const item of items) {
                if (published >= maxThisRun) break;
                if (existingTitles.has(item.title)) continue;
                if (!item.title || item.fullText.length < 100) continue;
                await processOneArticle(item, feed);
                published++;
                break;
            }
            if (published > 0) break;
        }
    }

    console.log(`\nPublished this run: ${published}`);

    // === Save and sync ===
    // Merge and save articles DB (keep last 100)
    const allArticles = [...newArticles, ...existingArticles].slice(0, 100);
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
