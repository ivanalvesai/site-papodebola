#!/usr/bin/env node
/**
 * PAPO DE BOLA - API-Football Cache Builder
 * Busca standings, rodadas e artilheiros via API-Football (100 req/dia grátis)
 * Substitui AllSportsApi para dados de futebol.
 *
 * API: https://v3.football.api-sports.io
 * Docs: https://www.api-football.com/documentation-v3
 * Free: 100 req/dia, registrar em dashboard.api-football.com
 *
 * Gera: champ_{id}.json, standings_brasileirao.json, scorers_brasileirao.json
 * AllSportsApi fica como fallback.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Chave API-Football (grátis, registrar em dashboard.api-football.com)
const API_KEY = process.env.APIFOOTBALL_KEY || '';
const API_HOST = 'v3.football.api-sports.io';
const CACHE_DIR = path.dirname(__filename);

if (!API_KEY) {
    console.error('ERRO: APIFOOTBALL_KEY não configurada.');
    console.error('Registre em https://dashboard.api-football.com e adicione ao .env');
    process.exit(1);
}

// Mapeamento: AllSportsApi tournament ID -> API-Football league ID
const LEAGUES = [
    { allsportsId: 325, apifbId: 71, season: 2026, name: 'Brasileirão Série A', hasScorers: true },
    { allsportsId: 373, apifbId: 73, season: 2026, name: 'Copa do Brasil', hasScorers: false },
    { allsportsId: 384, apifbId: 13, season: 2026, name: 'Libertadores', hasScorers: false },
    { allsportsId: 7,   apifbId: 2,  season: 2025, name: 'Champions League', hasScorers: false },
];

// Mapeamento: nome API-Football -> Sofascore team ID (escudos via proxy)
const TEAM_NAME_TO_ID = {
    'Palmeiras': 1963, 'Flamengo': 5981, 'Corinthians': 1957, 'Sao Paulo': 1981, 'São Paulo': 1981,
    'Santos': 1968, 'Fluminense': 1961, 'Botafogo': 1958, 'Vasco DA Gama': 1974, 'Vasco da Gama': 1974,
    'Gremio': 5926, 'Grêmio': 5926, 'Internacional': 1966, 'Atletico-MG': 1977, 'Atlético Mineiro': 1977,
    'Cruzeiro': 1954, 'Bahia': 1955, 'Fortaleza': 2020, 'Athletico-PR': 1967, 'Athletico Paranaense': 1967,
    'RB Bragantino': 1999, 'Bragantino': 1999, 'Coritiba': 1982, 'Sport Recife': 1979,
    'Ceara': 2001, 'Cuiaba': 7315, 'Juventude': 1998, 'America-MG': 1973,
    'Chapecoense-SC': 7314, 'Chapecoense': 7314, 'Vitoria': 1976, 'Vitória': 1976,
    'Mirassol': 7319, 'Remo': 2009, 'Goias': 1958, 'Paysandu': 2007,
    'Real Madrid': 2829, 'Barcelona': 2817, 'Liverpool': 44, 'Manchester City': 17,
    'Bayern München': 2672, 'Bayern Munich': 2672, 'PSG': 1644, 'Paris Saint Germain': 1644,
    'Juventus': 2687, 'Inter': 2697, 'AC Milan': 2692, 'Arsenal': 42,
    'Boca Juniors': 5765, 'River Plate': 5765, 'Racing Club': 5766,
};

let requestCount = 0;

function fetchAPI(endpoint) {
    requestCount++;
    return new Promise((resolve) => {
        const req = https.request({
            hostname: API_HOST,
            path: `/v3/${endpoint}`,
            method: 'GET',
            headers: { 'x-apisports-key': API_KEY },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.errors && Object.keys(parsed.errors).length > 0) {
                            console.log(`  API ERROR: ${JSON.stringify(parsed.errors)}`);
                            resolve(null);
                        } else {
                            resolve(parsed);
                        }
                    } catch { resolve(null); }
                } else {
                    console.log(`  FAIL: ${endpoint} (HTTP ${res.statusCode})`);
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => { console.log(`  ERROR: ${e.message}`); resolve(null); });
        req.setTimeout(30000, () => { req.destroy(); resolve(null); });
        req.end();
    });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function resolveTeamId(name) {
    if (!name) return null;
    if (TEAM_NAME_TO_ID[name]) return TEAM_NAME_TO_ID[name];
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const [n, id] of Object.entries(TEAM_NAME_TO_ID)) {
        const nNorm = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (nNorm === normalized || nNorm.includes(normalized) || normalized.includes(nNorm)) return id;
    }
    return null;
}

async function buildLeague(league) {
    console.log(`\n  === ${league.name} (API-Football ID: ${league.apifbId}) ===`);
    const cacheFile = path.join(CACHE_DIR, `champ_${league.allsportsId}.json`);

    // Load existing cache to preserve data
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}
    const existingMatches = existing.matchesByRound || {};

    // 1. Standings (1 req)
    console.log('  Fetching standings...');
    const standingsData = await fetchAPI(`standings?league=${league.apifbId}&season=${league.season}`);
    await delay(500);

    let standings = null;
    if (standingsData?.response?.[0]?.league?.standings) {
        const groups = standingsData.response[0].league.standings;
        standings = groups.map(group => ({
            name: group.length > 1 ? (group[0]?.group || '') : '',
            rows: group.map(r => ({
                pos: r.rank,
                team: r.team?.name || '?',
                teamId: resolveTeamId(r.team?.name) || r.team?.id,
                pts: r.points,
                matches: r.all?.played || 0,
                wins: r.all?.win || 0,
                draws: r.all?.draw || 0,
                losses: r.all?.lose || 0,
                gf: r.all?.goals?.for || 0,
                ga: r.all?.goals?.against || 0,
                gd: r.goalsDiff || 0,
                promo: r.description || '',
            })),
        }));
        console.log(`  Standings: ${standings[0]?.rows?.length || 0} teams, leader: ${standings[0]?.rows?.[0]?.team || '?'}`);
    }

    // 2. Available rounds (1 req)
    console.log('  Fetching rounds...');
    const roundsData = await fetchAPI(`fixtures/rounds?league=${league.apifbId}&season=${league.season}&current=true`);
    await delay(500);

    let currentRoundStr = roundsData?.response?.[0] || '';
    // Extract round number from "Regular Season - 10"
    const currentRound = parseInt(currentRoundStr.replace(/[^0-9]/g, '')) || 1;
    console.log(`  Current round: ${currentRound} (${currentRoundStr})`);

    // 3. Fetch current round ±2 (up to 5 req)
    const matchesByRound = { ...existingMatches };
    const roundsToFetch = [];
    for (let r = currentRound - 2; r <= currentRound + 2; r++) {
        if (r >= 1) roundsToFetch.push(r);
    }

    for (const round of roundsToFetch) {
        const roundLabel = `Regular Season - ${round}`;
        console.log(`  Fetching round ${round}...`);
        const fixturesData = await fetchAPI(`fixtures?league=${league.apifbId}&season=${league.season}&round=${encodeURIComponent(roundLabel)}`);
        await delay(500);

        if (fixturesData?.response?.length > 0) {
            matchesByRound[round] = fixturesData.response.map(f => ({
                id: f.fixture?.id || 0,
                home: f.teams?.home?.name || '?',
                away: f.teams?.away?.name || '?',
                homeId: resolveTeamId(f.teams?.home?.name) || f.teams?.home?.id,
                awayId: resolveTeamId(f.teams?.away?.name) || f.teams?.away?.id,
                homeScore: f.goals?.home ?? null,
                awayScore: f.goals?.away ?? null,
                status: f.fixture?.status?.short === 'FT' ? 'finished'
                    : f.fixture?.status?.short === 'NS' ? 'notstarted'
                    : f.fixture?.status?.long === 'Match Finished' ? 'finished'
                    : ['1H', '2H', 'HT', 'ET', 'P'].includes(f.fixture?.status?.short) ? 'inprogress'
                    : 'notstarted',
                statusDesc: f.fixture?.status?.long || '',
                timestamp: f.fixture?.timestamp || null,
                round: round,
            }));
            console.log(`    Round ${round}: ${fixturesData.response.length} matches`);
        }
    }

    // All known rounds
    const allRounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

    // 4. Top scorers for Brasileirão (1 req)
    let topScorers = existing.topScorers || [];
    if (league.hasScorers) {
        console.log('  Fetching top scorers...');
        const scorersData = await fetchAPI(`players/topscorers?league=${league.apifbId}&season=${league.season}`);
        await delay(500);

        if (scorersData?.response?.length > 0) {
            topScorers = scorersData.response.slice(0, 10).map(p => ({
                name: p.player?.name || '?',
                playerId: p.player?.id || 0,
                team: p.statistics?.[0]?.team?.name || '?',
                teamId: resolveTeamId(p.statistics?.[0]?.team?.name) || p.statistics?.[0]?.team?.id,
                goals: p.statistics?.[0]?.goals?.total || 0,
            }));
            console.log(`  Top scorers: ${topScorers.length} players, leader: ${topScorers[0]?.name} (${topScorers[0]?.goals} gols)`);
        }
    }

    // Write champ_{id}.json
    const champData = {
        tournament: { id: league.allsportsId, seasonId: league.season, name: league.name },
        rounds: allRounds,
        currentRound: currentRound,
        standings: standings,
        matchesByRound: matchesByRound,
        topScorers: topScorers,
        source: 'api-football',
        updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(cacheFile, JSON.stringify(champData));
    const size = fs.statSync(cacheFile).size;
    console.log(`  Saved: champ_${league.allsportsId}.json (${(size / 1024).toFixed(0)} KB)`);

    // For Brasileirão, also write standings_brasileirao.json (sidebar format)
    if (league.allsportsId === 325 && standings?.[0]?.rows) {
        const sidebarStandings = {
            standings: [{
                rows: standings[0].rows.map(r => ({
                    team: { id: r.teamId, name: r.team },
                    points: r.pts,
                    matches: r.matches,
                    wins: r.wins,
                    draws: r.draws,
                    losses: r.losses,
                    scoresFor: r.gf,
                    scoresAgainst: r.ga,
                    scoreDiffFormatted: (r.gd >= 0 ? '+' : '') + r.gd,
                    position: r.pos,
                })),
            }],
        };
        fs.writeFileSync(path.join(CACHE_DIR, 'standings_brasileirao.json'), JSON.stringify(sidebarStandings));
        console.log('  Saved: standings_brasileirao.json');

        // Also write scorers_brasileirao.json
        if (topScorers.length > 0) {
            fs.writeFileSync(path.join(CACHE_DIR, 'scorers_brasileirao.json'), JSON.stringify({
                topScorers: topScorers,
                updatedAt: new Date().toISOString(),
            }));
            console.log('  Saved: scorers_brasileirao.json');
        }
    }

    return true;
}

async function buildTodayTomorrow() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Today's matches (1 req) - all football worldwide
    console.log(`\n  Fetching today's matches (${today})...`);
    const todayData = await fetchAPI(`fixtures?date=${today}`);
    await delay(500);

    if (todayData?.response) {
        const todayFile = path.join(CACHE_DIR, 'today.json');
        // Convert to AllSportsApi format for compatibility
        const events = todayData.response.map(f => ({
            id: f.fixture?.id,
            tournament: {
                uniqueTournament: { id: f.league?.id, name: f.league?.name },
                name: f.league?.name,
                category: { name: f.league?.country },
            },
            homeTeam: { id: resolveTeamId(f.teams?.home?.name) || f.teams?.home?.id, name: f.teams?.home?.name, shortName: f.teams?.home?.name },
            awayTeam: { id: resolveTeamId(f.teams?.away?.name) || f.teams?.away?.id, name: f.teams?.away?.name, shortName: f.teams?.away?.name },
            homeScore: { current: f.goals?.home },
            awayScore: { current: f.goals?.away },
            startTimestamp: f.fixture?.timestamp,
            status: {
                type: f.fixture?.status?.short === 'FT' ? 'finished'
                    : f.fixture?.status?.short === 'NS' ? 'notstarted'
                    : ['1H', '2H', 'HT', 'ET', 'P'].includes(f.fixture?.status?.short) ? 'inprogress'
                    : 'notstarted',
                description: f.fixture?.status?.long || '',
            },
        }));
        fs.writeFileSync(todayFile, JSON.stringify({ events }));
        console.log(`  Today: ${events.length} matches saved`);
    }

    // Tomorrow's matches (1 req)
    console.log(`  Fetching tomorrow's matches (${tomorrow})...`);
    const tomorrowData = await fetchAPI(`fixtures?date=${tomorrow}`);
    await delay(500);

    if (tomorrowData?.response) {
        const tomorrowFile = path.join(CACHE_DIR, 'tomorrow.json');
        const events = tomorrowData.response.map(f => ({
            id: f.fixture?.id,
            tournament: {
                uniqueTournament: { id: f.league?.id, name: f.league?.name },
                name: f.league?.name,
                category: { name: f.league?.country },
            },
            homeTeam: { id: resolveTeamId(f.teams?.home?.name) || f.teams?.home?.id, name: f.teams?.home?.name, shortName: f.teams?.home?.name },
            awayTeam: { id: resolveTeamId(f.teams?.away?.name) || f.teams?.away?.id, name: f.teams?.away?.name, shortName: f.teams?.away?.name },
            homeScore: { current: f.goals?.home },
            awayScore: { current: f.goals?.away },
            startTimestamp: f.fixture?.timestamp,
            status: {
                type: f.fixture?.status?.short === 'FT' ? 'finished'
                    : f.fixture?.status?.short === 'NS' ? 'notstarted'
                    : 'notstarted',
                description: f.fixture?.status?.long || '',
            },
        }));
        fs.writeFileSync(tomorrowFile, JSON.stringify({ events }));
        console.log(`  Tomorrow: ${events.length} matches saved`);
    }
}

async function main() {
    console.log('=== API-Football Cache Builder ===');
    console.log(`Time: ${new Date().toISOString()}`);

    // Check quota first
    const status = await fetchAPI('status');
    if (status?.response) {
        const s = status.response;
        const used = s.requests?.current || 0;
        const limit = s.requests?.limit_day || 100;
        console.log(`Quota: ${used}/${limit} req today (${limit - used} remaining)`);
        if (used >= limit - 5) {
            console.log('WARN: Quota almost exhausted, skipping to save requests');
            process.exit(0);
        }
    }

    // Today + Tomorrow (2 req)
    await buildTodayTomorrow();

    // Championships (standings + rounds)
    for (const league of LEAGUES) {
        await buildLeague(league);
    }

    console.log(`\n=== Done! Total: ${requestCount} API-Football requests ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
