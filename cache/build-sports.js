#!/usr/bin/env node
/**
 * PAPO DE BOLA - Sports Cache Builder
 * Busca dados de todos os esportes (NBA, Tênis, F1, MMA, etc.)
 * e salva em cache JSON para evitar chamadas diretas à API.
 *
 * Roda a cada 30 minutos via cron (update.sh).
 * Gera: sport_{slug}.json para cada esporte
 *        agenda_{date}.json para hoje/amanhã/+2 dias
 *        athletes.json com dados de atletas
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2';
const API_HOST = 'allsportsapi2.p.rapidapi.com';
const CACHE_DIR = path.join(__dirname);

// Sport configurations (same as esporte.html)
const SPORTS = {
    nba: { api: 'basketball', tournamentId: 132, seasonId: 80229, hasStandings: true, hasRankings: false },
    tenis: { api: 'tennis', tournamentId: null, seasonId: null, hasStandings: false, hasRankings: true, rankingType: 'atp' },
    f1: { api: 'motorsport', tournamentId: null, seasonId: null, hasStandings: false, hasRankings: false },
    mma: { api: 'mma', tournamentId: 19906, seasonId: null, hasStandings: false, hasRankings: false },
    volei: { api: 'volleyball', tournamentId: null, seasonId: null, hasStandings: false, hasRankings: false },
    nfl: { api: 'american-football', tournamentId: null, seasonId: null, hasStandings: false, hasRankings: false },
};

// Athletes to cache (from esporte.html)
const ATHLETES = [
    // NBA
    { id: 817181, sport: 'basketball', name: 'LeBron James' },
    { id: 817050, sport: 'basketball', name: 'Stephen Curry' },
    { id: 861608, sport: 'basketball', name: 'Luka Dončić' },
    { id: 838689, sport: 'basketball', name: 'Nikola Jokić' },
    { id: 998725, sport: 'basketball', name: 'Victor Wembanyama' },
    { id: 885203, sport: 'basketball', name: 'Jayson Tatum' },
    // Tennis
    { id: 275923, sport: 'tennis', name: 'Carlos Alcaraz' },
    { id: 206570, sport: 'tennis', name: 'Jannik Sinner' },
    { id: 14882, sport: 'tennis', name: 'Novak Djokovic' },
    { id: 403869, sport: 'tennis', name: 'João Fonseca' },
    { id: 57163, sport: 'tennis', name: 'Alexander Zverev' },
    { id: 261015, sport: 'tennis', name: 'Lorenzo Musetti' },
    // F1
    { id: 191417, sport: 'motorsport', name: 'Max Verstappen' },
    { id: 7135, sport: 'motorsport', name: 'Lewis Hamilton' },
    { id: 226818, sport: 'motorsport', name: 'Charles Leclerc' },
    { id: 312056, sport: 'motorsport', name: 'Lando Norris' },
    { id: 1041650, sport: 'motorsport', name: 'Gabriel Bortoleto' },
    // MMA
    { id: 461782, sport: 'mma', name: 'Islam Makhachev' },
    { id: 470040, sport: 'mma', name: 'Alex Pereira' },
    { id: 461872, sport: 'mma', name: 'Ilia Topuria' },
];

let requestCount = 0;

function apiFetch(endpoint) {
    return new Promise((resolve) => {
        requestCount++;
        const options = {
            hostname: API_HOST,
            path: `/api/${endpoint}`,
            method: 'GET',
            headers: {
                'x-rapidapi-key': API_KEY,
                'x-rapidapi-host': API_HOST,
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)); } catch { resolve(null); }
                } else {
                    if (res.statusCode === 429) console.log(`  QUOTA EXCEEDED: ${endpoint}`);
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.setTimeout(30000, () => { req.destroy(); resolve(null); });
        req.end();
    });
}

function saveCache(filename, data) {
    const filepath = path.join(CACHE_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 0));
    const size = fs.statSync(filepath).size;
    console.log(`  Saved ${filename} (${size} bytes)`);
}

// Delay between requests to avoid rate limiting
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function buildSportCache(slug, config) {
    if (!config.api) return;

    console.log(`\nBuilding cache for: ${slug} (${config.api})`);
    const result = { live: [], today: [], calendar: [], standings: null, rankings: null, updated: new Date().toISOString() };

    // Determine endpoint prefix
    const usesEvents = ['tennis', 'basketball', 'mma', 'volleyball', 'american-football', 'ice-hockey', 'baseball', 'handball', 'motorsport'];
    const pathPrefix = usesEvents.includes(config.api) ? 'events' : 'matches';

    // 1. Live events
    const liveData = await apiFetch(`${config.api}/${pathPrefix}/live`);
    result.live = liveData?.events || [];
    console.log(`  Live: ${result.live.length} events`);
    await delay(300);

    // 2. Today's events
    const now = new Date();
    const todayData = await apiFetch(`${config.api}/${pathPrefix}/${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`);
    result.today = todayData?.events || [];
    console.log(`  Today: ${result.today.length} events`);
    await delay(300);

    // 3. Calendar (next 3 days) — skip if today had 0 events (sport likely off-season)
    if (result.today.length > 0 || result.live.length > 0) {
        for (let i = 1; i <= 3; i++) {
            const d = new Date(Date.now() + i * 86400000);
            const calData = await apiFetch(`${config.api}/${pathPrefix}/${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
            const events = calData?.events || [];
            if (events.length > 0) {
                result.calendar.push({
                    date: d.toISOString().split('T')[0],
                    label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
                    events: events,
                });
            }
            console.log(`  Day +${i}: ${events.length} events`);
            await delay(300);
        }
    } else {
        console.log('  Skipping calendar (no events today)');
    }

    // 4. Standings (NBA)
    if (config.hasStandings && config.tournamentId && config.seasonId) {
        const standingsData = await apiFetch(`${config.api}/tournament/${config.tournamentId}/season/${config.seasonId}/standings/total`);
        result.standings = standingsData?.standings || null;
        console.log(`  Standings: ${result.standings ? 'OK' : 'unavailable'}`);
        await delay(300);
    }

    // 5. Rankings (Tennis)
    if (config.hasRankings && config.rankingType) {
        const rankData = await apiFetch(`${config.api}/rankings/${config.rankingType}`);
        result.rankings = rankData?.rankings || null;
        console.log(`  Rankings: ${result.rankings ? result.rankings.length + ' entries' : 'unavailable'}`);
        await delay(300);
    }

    saveCache(`sport_${slug}.json`, result);
}

async function buildAgendaCache() {
    console.log('\nBuilding agenda cache (football)...');

    // Today and tomorrow are already cached by update.sh (today.json, tomorrow.json)
    // Cache +2 to +3 days ahead and 1 day back (4 requests total)
    const offsets = [2, 3, -1];
    for (const i of offsets) {
        const d = new Date(Date.now() + i * 86400000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const data = await apiFetch(`matches/${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
        if (data?.events) {
            saveCache(`agenda_${dateStr}.json`, data);
        }
        console.log(`  Agenda ${dateStr}: ${data?.events?.length || 0} events`);
        await delay(300);
    }
}

async function buildAthleteCache() {
    console.log('\nBuilding athlete cache...');

    // Load existing cache to preserve info (rarely changes)
    const cacheFile = path.join(CACHE_DIR, 'athletes.json');
    let athletes = {};
    try { athletes = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}

    for (const athlete of ATHLETES) {
        const key = `${athlete.sport}_${athlete.id}`;
        const existing = athletes[key] || {};
        console.log(`  Fetching ${athlete.name}...`);

        const result = { info: existing.info || null, previous: [], next: [], updated: new Date().toISOString() };

        // Only fetch info if we don't have it cached yet
        if (!result.info) {
            const infoData = await apiFetch(`${athlete.sport}/team/${athlete.id}`);
            result.info = infoData?.team || null;
            await delay(300);
        }

        // Previous events (1 request)
        const prevData = await apiFetch(`${athlete.sport}/team/${athlete.id}/events/previous/0`);
        result.previous = prevData?.events || [];
        await delay(300);

        // Next events (1 request)
        const nextData = await apiFetch(`${athlete.sport}/team/${athlete.id}/events/next/0`);
        result.next = nextData?.events || [];
        await delay(300);

        athletes[key] = result;
        console.log(`  ${athlete.name}: info=${result.info ? 'OK' : 'cached'}, prev=${result.previous.length}, next=${result.next.length}`);
    }

    saveCache('athletes.json', athletes);
}

async function main() {
    console.log('=== Sports Cache Builder ===');
    console.log(`Time: ${new Date().toISOString()}`);

    // Build sport caches
    for (const [slug, config] of Object.entries(SPORTS)) {
        await buildSportCache(slug, config);
    }

    // Build agenda cache (football extra days)
    await buildAgendaCache();

    // Build athlete cache (every 3 hours only - controlled by update.sh)
    const hour = new Date().getHours();
    if (hour % 3 === 0 || !fs.existsSync(path.join(CACHE_DIR, 'athletes.json'))) {
        await buildAthleteCache();
    } else {
        console.log('\nSkipping athlete cache (runs every 3h)');
    }

    console.log(`\n=== Done! Total API requests: ${requestCount} ===`);
}

main().catch(console.error);
