#!/usr/bin/env node
/**
 * PAPO DE BOLA - CBF API Cache Builder
 * Busca dados do futebol brasileiro direto da API da CBF (gratuita).
 * Gera: champ_325.json, champ_390.json, champ_373.json, standings_brasileirao.json
 *
 * API: https://gweb.cbf.com.br/api/site/v1
 * Auth: Bearer Cbf@2022! (token público do JS do site cbf.com.br)
 *
 * Vantagem: 1 requisição = todos os jogos do campeonato (vs AllSportsApi = 1 req por rodada)
 * Fallback: se CBF falhar, build-championship.js pega da AllSportsApi
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CBF_BASE = 'https://gweb.cbf.com.br/api/site/v1';
const CBF_TOKEN = 'Cbf@2022!';
const CACHE_DIR = path.dirname(__filename);

// Mapeamento: AllSportsApi tournament ID -> CBF championship ID
const CBF_CHAMPIONSHIPS = [
    { allsportsId: 325, cbfId: '1260611', name: 'Brasileirão Série A', seasonId: 87678, hasStandings: true, teamsCount: 20 },
    { allsportsId: 390, cbfId: '1260612', name: 'Brasileirão Série B', seasonId: 89840, hasStandings: true, teamsCount: 20 },
    { allsportsId: 373, cbfId: '1260615', name: 'Copa do Brasil', seasonId: 89353, hasStandings: false, teamsCount: null },
];

// Mapeamento: nome CBF -> Sofascore team ID (para escudos via proxy nginx)
const TEAM_NAME_TO_ID = {
    'Palmeiras': 1963, 'Flamengo': 5981, 'Corinthians': 1957, 'São Paulo': 1981,
    'Santos': 1968, 'Fluminense': 1961, 'Botafogo': 1958, 'Vasco': 1974,
    'Grêmio': 5926, 'Internacional': 1966, 'Atlético Mineiro': 1977, 'Cruzeiro': 1954,
    'Bahia': 1955, 'Fortaleza': 2020, 'Athletico Paranaense': 1967, 'Bragantino': 1999,
    'Coritiba': 1982, 'Coritiba SAF': 1982,
    'Sport': 1979, 'Ceará': 2001, 'Goiás': 1958, 'Cuiabá': 7315,
    'Juventude': 1998, 'América-MG': 1973, 'América Mineiro': 1973,
    'Chapecoense': 7314, 'Avaí': 1994, 'Ponte Preta': 1985,
    'Guarani': 1984, 'Vitória': 1976, 'Náutico': 2004,
    'CRB': 2005, 'CSA': 2006, 'Londrina': 7313, 'Operário-PR': 7312,
    'Novorizontino': 7318, 'Vila Nova': 2008, 'Sampaio Corrêa': 7316,
    'Tombense': 7320, 'Ituano': 7317, 'ABC': 2003,
    'Paysandu': 2007, 'Remo': 2009, 'Mirassol': 7319,
    'Sport Recife': 1979, 'Athletico-PR': 1967, 'Atlético-MG': 1977,
    'Red Bull Bragantino': 1999, 'RB Bragantino': 1999,
    'Flamengo RJ': 5981, 'Botafogo RJ': 1958, 'Vasco da Gama': 1974,
    'São Paulo FC': 1981, 'SC Corinthians': 1957, 'SE Palmeiras': 1963,
    'EC Bahia': 1955, 'Fortaleza EC': 2020, 'Ceará SC': 2001,
    'Grêmio FBPA': 5926, 'SC Internacional': 1966, 'Santos FC': 1968,
};

let requestCount = 0;

function fetchCBF(endpoint) {
    requestCount++;
    return new Promise((resolve) => {
        const url = `${CBF_BASE}${endpoint}`;
        const options = {
            hostname: 'gweb.cbf.com.br',
            path: `/api/site/v1${endpoint}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CBF_TOKEN}`,
                'Accept': 'application/json',
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)); } catch { resolve(null); }
                } else {
                    console.log(`  CBF FAIL: ${endpoint} (HTTP ${res.statusCode})`);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => { console.log(`  CBF ERROR: ${e.message}`); resolve(null); });
        req.setTimeout(30000, () => { req.destroy(); resolve(null); });
        req.end();
    });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Resolve Sofascore team ID from CBF team name
function resolveTeamId(cbfName) {
    if (!cbfName) return null;
    // Try exact match
    if (TEAM_NAME_TO_ID[cbfName]) return TEAM_NAME_TO_ID[cbfName];
    // Try normalized match (remove accents, case insensitive)
    const normalized = cbfName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const [name, id] of Object.entries(TEAM_NAME_TO_ID)) {
        const nameNorm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (nameNorm === normalized || nameNorm.includes(normalized) || normalized.includes(nameNorm)) {
            return id;
        }
    }
    return null;
}

// Parse CBF date format " DD/MM/YYYY" and time "HH:MM" to unix timestamp
function parseCBFDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    const d = dateStr.trim();
    const parts = d.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    const time = timeStr || '00:00';
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00-03:00`;
    try {
        return Math.floor(new Date(iso).getTime() / 1000);
    } catch { return null; }
}

// Determine match status from CBF data
function mapCBFStatus(match) {
    const homeGols = parseInt(match.mandante?.gols);
    const awayGols = parseInt(match.visitante?.gols);
    const hasScore = !isNaN(homeGols) && !isNaN(awayGols);
    const timestamp = parseCBFDateTime(match.data, match.hora);
    const now = Math.floor(Date.now() / 1000);

    if (hasScore && (homeGols > 0 || awayGols > 0)) {
        return 'finished';
    }
    // If has timestamp and it's in the past but score is 0x0, could be finished or not started
    if (timestamp && timestamp < now - 7200) { // 2h after start = probably finished
        return hasScore ? 'finished' : 'notstarted';
    }
    return 'notstarted';
}

// Calculate standings from match results
function calculateStandings(matches, teamsCount) {
    const teams = {};

    for (const match of matches) {
        const homeGols = parseInt(match.mandante?.gols);
        const awayGols = parseInt(match.visitante?.gols);
        const homeName = match.mandante?.nome;
        const awayName = match.visitante?.nome;

        if (!homeName || !awayName) continue;

        // Initialize teams
        if (!teams[homeName]) teams[homeName] = { name: homeName, pts: 0, matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
        if (!teams[awayName]) teams[awayName] = { name: awayName, pts: 0, matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };

        // Only count finished matches with valid scores
        if (isNaN(homeGols) || isNaN(awayGols)) continue;
        const hasScore = homeGols > 0 || awayGols > 0;
        const timestamp = parseCBFDateTime(match.data, match.hora);
        const isPast = timestamp && timestamp < (Date.now() / 1000 - 7200);
        if (!hasScore && !isPast) continue; // Skip future matches
        // 0x0 matches that are in the past are valid finished matches

        teams[homeName].matches++;
        teams[awayName].matches++;
        teams[homeName].gf += homeGols;
        teams[homeName].ga += awayGols;
        teams[awayName].gf += awayGols;
        teams[awayName].ga += homeGols;

        if (homeGols > awayGols) {
            teams[homeName].wins++; teams[homeName].pts += 3;
            teams[awayName].losses++;
        } else if (awayGols > homeGols) {
            teams[awayName].wins++; teams[awayName].pts += 3;
            teams[homeName].losses++;
        } else {
            teams[homeName].draws++; teams[homeName].pts += 1;
            teams[awayName].draws++; teams[awayName].pts += 1;
        }
    }

    // Sort: pts DESC, wins DESC, goal diff DESC, goals scored DESC
    const sorted = Object.values(teams).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.wins !== a.wins) return b.wins - a.wins;
        const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
        if (gdB !== gdA) return gdB - gdA;
        return b.gf - a.gf;
    });

    return sorted;
}

async function buildChampionship(config) {
    console.log(`\n  Fetching ${config.name} (CBF ID: ${config.cbfId})...`);

    const data = await fetchCBF(`/jogos/campeonato/${config.cbfId}`);
    if (!data || !data.jogos) {
        console.log(`  FAILED: No data for ${config.name}`);
        return false;
    }

    const matches = data.jogos;
    console.log(`  OK: ${matches.length} matches`);

    // Group by round
    const matchesByRound = {};
    const roundSet = new Set();

    for (const m of matches) {
        const round = parseInt(m.rodada) || 1;
        roundSet.add(round);
        if (!matchesByRound[round]) matchesByRound[round] = [];

        matchesByRound[round].push({
            id: parseInt(m.id_jogo) || 0,
            home: m.mandante?.nome || '?',
            away: m.visitante?.nome || '?',
            homeId: resolveTeamId(m.mandante?.nome),
            awayId: resolveTeamId(m.visitante?.nome),
            homeScore: isNaN(parseInt(m.mandante?.gols)) ? null : parseInt(m.mandante?.gols),
            awayScore: isNaN(parseInt(m.visitante?.gols)) ? null : parseInt(m.visitante?.gols),
            status: mapCBFStatus(m),
            statusDesc: '',
            timestamp: parseCBFDateTime(m.data, m.hora),
            round: round,
        });
    }

    const rounds = [...roundSet].sort((a, b) => a - b);

    // Detect current round: first round with unfinished matches
    let currentRound = rounds[rounds.length - 1] || 1;
    for (const r of rounds) {
        const roundMatches = matchesByRound[r] || [];
        const hasUnplayed = roundMatches.some(m => m.status === 'notstarted');
        if (hasUnplayed) { currentRound = r; break; }
    }

    // Calculate standings
    let standings = null;
    if (config.hasStandings) {
        const standingsData = calculateStandings(matches, config.teamsCount);
        standings = [{
            name: '',
            rows: standingsData.map((t, i) => ({
                pos: i + 1,
                team: t.name,
                teamId: resolveTeamId(t.name),
                pts: t.pts,
                matches: t.matches,
                wins: t.wins,
                draws: t.draws,
                losses: t.losses,
                gf: t.gf,
                ga: t.ga,
                gd: t.gf - t.ga,
                promo: '',
            })),
        }];
        console.log(`  Standings: ${standingsData.length} teams, leader: ${standingsData[0]?.name || '?'} (${standingsData[0]?.pts || 0} pts)`);
    }

    // Load existing cache to preserve topScorers
    const cacheFile = path.join(CACHE_DIR, `champ_${config.allsportsId}.json`);
    let existingScorers = [];
    try {
        const existing = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        existingScorers = existing.topScorers || [];
    } catch {}

    // Write champ_{id}.json
    const champData = {
        tournament: { id: config.allsportsId, seasonId: config.seasonId, name: config.name },
        rounds: rounds,
        currentRound: currentRound,
        standings: standings,
        matchesByRound: matchesByRound,
        topScorers: existingScorers,
        source: 'cbf',
        updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(cacheFile, JSON.stringify(champData));
    const size = fs.statSync(cacheFile).size;
    console.log(`  Saved: champ_${config.allsportsId}.json (${size} bytes), rounds: ${rounds.length}, current: ${currentRound}`);

    // For Serie A, also write standings_brasileirao.json (sidebar format)
    if (config.allsportsId === 325 && standings) {
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
                    scoreDiffFormatted: (r.gf - r.ga >= 0 ? '+' : '') + (r.gf - r.ga),
                    position: r.pos,
                })),
            }],
        };
        const standingsFile = path.join(CACHE_DIR, 'standings_brasileirao.json');
        fs.writeFileSync(standingsFile, JSON.stringify(sidebarStandings));
        console.log(`  Saved: standings_brasileirao.json (sidebar format)`);
    }

    return true;
}

async function main() {
    console.log('=== CBF Cache Builder ===');
    console.log(`Time: ${new Date().toISOString()}`);

    let success = 0;
    for (const config of CBF_CHAMPIONSHIPS) {
        const ok = await buildChampionship(config);
        if (ok) success++;
        await delay(500);
    }

    console.log(`\n=== Done! ${success}/${CBF_CHAMPIONSHIPS.length} championships cached, ${requestCount} CBF requests ===`);

    // Exit with error if all failed (triggers fallback in update.sh)
    if (success === 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
