#!/usr/bin/env node
/**
 * PAPO DE BOLA - CBF API Cache Builder
 * Busca CALENDÁRIO do futebol brasileiro da API da CBF (gratuita).
 * Gera: cbf_calendario.json (datas, horários, times, estádios)
 *
 * NÃO usa: placares e standings (dados invertidos na CBF, usar AllSportsApi)
 * USA: datas, horários, confrontos, estádios, rodadas — 100% corretos
 *
 * API: https://gweb.cbf.com.br/api/site/v1
 * Auth: Bearer Cbf@2022! (token público do JS do site cbf.com.br)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CBF_BASE = 'https://gweb.cbf.com.br/api/site/v1';
const CBF_TOKEN = 'Cbf@2022!';
const CACHE_DIR = path.dirname(__filename);

// Campeonatos brasileiros
const CBF_CHAMPIONSHIPS = [
    { cbfId: '1260611', name: 'Brasileirão Série A', slug: 'serie-a' },
    { cbfId: '1260612', name: 'Brasileirão Série B', slug: 'serie-b' },
    { cbfId: '1260615', name: 'Copa do Brasil', slug: 'copa-do-brasil' },
];

// Mapeamento: nome CBF -> Sofascore team ID (para escudos via proxy nginx)
const TEAM_NAME_TO_ID = {
    'Palmeiras': 1963, 'Flamengo': 5981, 'Corinthians': 1957, 'São Paulo': 1981,
    'Santos': 1968, 'Santos Fc': 1968, 'Fluminense': 1961, 'Botafogo': 1958,
    'Vasco': 1974, 'Vasco da Gama Saf': 1974, 'Vasco da Gama': 1974,
    'Grêmio': 5926, 'Internacional': 1966, 'Atlético Mineiro': 1977, 'Cruzeiro': 1954,
    'Bahia': 1955, 'Fortaleza': 2020, 'Athletico Paranaense': 1967, 'Bragantino': 1999,
    'Red Bull Bragantino': 1999, 'RB Bragantino': 1999,
    'Coritiba': 1982, 'Coritiba SAF': 1982,
    'Sport': 1979, 'Sport Recife': 1979, 'Ceará': 2001, 'Ceará SC': 2001,
    'Goiás': 1958, 'Cuiabá': 7315, 'Juventude': 1998,
    'América-MG': 1973, 'América Mineiro': 1973,
    'Chapecoense': 7314, 'Avaí': 1994, 'Ponte Preta': 1985,
    'Guarani': 1984, 'Vitória': 1976, 'Náutico': 2004,
    'CRB': 2005, 'CSA': 2006, 'Londrina': 7313, 'Operário-PR': 7312,
    'Novorizontino': 7318, 'Vila Nova': 2008, 'Sampaio Corrêa': 7316,
    'Tombense': 7320, 'Ituano': 7317, 'ABC': 2003,
    'Paysandu': 2007, 'Remo': 2009, 'Mirassol': 7319,
    'Athletico-PR': 1967, 'Atlético-MG': 1977,
    'Flamengo RJ': 5981, 'Botafogo RJ': 1958,
    'São Paulo FC': 1981, 'SC Corinthians': 1957, 'SE Palmeiras': 1963,
    'EC Bahia': 1955, 'Fortaleza EC': 2020,
    'Grêmio FBPA': 5926, 'SC Internacional': 1966,
};

let requestCount = 0;

function fetchCBF(endpoint) {
    requestCount++;
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'gweb.cbf.com.br',
            path: `/api/site/v1${endpoint}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${CBF_TOKEN}`, 'Accept': 'application/json' },
        }, (res) => {
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

function resolveTeamId(cbfName) {
    if (!cbfName) return null;
    if (TEAM_NAME_TO_ID[cbfName]) return TEAM_NAME_TO_ID[cbfName];
    const normalized = cbfName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const [name, id] of Object.entries(TEAM_NAME_TO_ID)) {
        const nameNorm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (nameNorm === normalized || nameNorm.includes(normalized) || normalized.includes(nameNorm)) {
            return id;
        }
    }
    return null;
}

// Parse CBF date " DD/MM/YYYY" + time "HH:MM" to unix timestamp
function parseCBFDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    const time = timeStr || '00:00';
    try {
        return Math.floor(new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00-03:00`).getTime() / 1000);
    } catch { return null; }
}

async function main() {
    console.log('=== CBF Calendar Builder ===');
    console.log(`Time: ${new Date().toISOString()}`);

    const calendario = { championships: [], updatedAt: new Date().toISOString() };

    for (const config of CBF_CHAMPIONSHIPS) {
        console.log(`\n  Fetching ${config.name}...`);
        const data = await fetchCBF(`/jogos/campeonato/${config.cbfId}`);

        if (!data || !data.jogos) {
            console.log(`  FAILED: No data`);
            continue;
        }

        const now = Math.floor(Date.now() / 1000);
        const matches = data.jogos.map(m => {
            const timestamp = parseCBFDateTime(m.data, m.hora);
            return {
                id: parseInt(m.id_jogo) || 0,
                round: parseInt(m.rodada) || 1,
                home: m.mandante?.nome || '?',
                away: m.visitante?.nome || '?',
                homeId: resolveTeamId(m.mandante?.nome),
                awayId: resolveTeamId(m.visitante?.nome),
                homeShield: m.mandante?.url_escudo || null,
                awayShield: m.visitante?.url_escudo || null,
                date: m.data?.trim() || '',
                time: m.hora || '',
                timestamp: timestamp,
                venue: m.local || '',
                isPast: timestamp ? timestamp < now - 10800 : false,
            };
        });

        // Separate: today, upcoming, past
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const todayTs = Math.floor(todayStart.getTime() / 1000);
        const todayEndTs = Math.floor(todayEnd.getTime() / 1000);

        const today = matches.filter(m => m.timestamp >= todayTs && m.timestamp <= todayEndTs);
        const upcoming = matches.filter(m => m.timestamp > todayEndTs).sort((a, b) => a.timestamp - b.timestamp);

        // Group by round
        const byRound = {};
        matches.forEach(m => {
            if (!byRound[m.round]) byRound[m.round] = [];
            byRound[m.round].push(m);
        });

        const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

        // Detect current round
        let currentRound = rounds[rounds.length - 1] || 1;
        for (const r of rounds) {
            if ((byRound[r] || []).some(m => !m.isPast)) { currentRound = r; break; }
        }

        calendario.championships.push({
            name: config.name,
            slug: config.slug,
            cbfId: config.cbfId,
            totalMatches: matches.length,
            rounds: rounds,
            currentRound: currentRound,
            today: today,
            upcoming: upcoming.slice(0, 30),
            byRound: byRound,
        });

        console.log(`  OK: ${matches.length} jogos, ${rounds.length} rodadas, atual: ${currentRound}, hoje: ${today.length}, próximos: ${upcoming.length}`);
        await delay(500);
    }

    // Save full calendar
    const calFile = path.join(CACHE_DIR, 'cbf_calendario.json');
    fs.writeFileSync(calFile, JSON.stringify(calendario));
    const size = fs.statSync(calFile).size;
    console.log(`\nSaved: cbf_calendario.json (${(size / 1024).toFixed(0)} KB)`);

    // Save today's Brazilian football games (for match bar)
    const todayGames = [];
    calendario.championships.forEach(c => {
        c.today.forEach(m => {
            todayGames.push({ ...m, championship: c.name });
        });
    });
    if (todayGames.length > 0) {
        const todayFile = path.join(CACHE_DIR, 'cbf_hoje.json');
        fs.writeFileSync(todayFile, JSON.stringify({ games: todayGames, updatedAt: new Date().toISOString() }));
        console.log(`Saved: cbf_hoje.json (${todayGames.length} jogos hoje)`);
    }

    console.log(`\n=== Done! ${requestCount} CBF requests ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
