#!/usr/bin/env node
/**
 * Caches championship data: rounds, standings for main tournaments
 * Runs every 3 hours (08h-23h)
 *
 * Otimizações:
 * - 4 torneios principais (era 8)
 * - Só rodada atual ±2 (era TODAS as rodadas)
 * - Preserva rodadas passadas do cache anterior
 * - Sem scorers (build-scorers.js já faz isso)
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.dirname(__filename);
const API_KEY = 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2';
const API_HOST = 'allsportsapi2.p.rapidapi.com';

// Torneios internacionais (brasileiros agora vêm da API CBF via build-cbf.js)
const TOURNAMENTS = [
    { id: 384, seasonId: 87760, name: 'Libertadores' },
    { id: 7,  seasonId: 76953, name: 'Champions League' },
];

let requestCount = 0;

function fetchAPI(endpoint) {
    requestCount++;
    return new Promise((resolve) => {
        https.get(`https://${API_HOST}/api/${endpoint}`, {
            headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST },
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    console.log('Building championship cache...');

    for (const t of TOURNAMENTS) {
        const cacheFile = path.join(CACHE_DIR, `champ_${t.id}.json`);

        // Carregar cache anterior para preservar rodadas já buscadas
        let existing = {};
        try { existing = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch {}
        const existingMatches = existing.matchesByRound || {};

        const champData = {
            tournament: t,
            rounds: null,
            currentRound: null,
            standings: null,
            matchesByRound: { ...existingMatches },
            updatedAt: new Date().toISOString(),
        };

        // 1. Get rounds info (1 req)
        const roundsData = await fetchAPI(`tournament/${t.id}/season/${t.seasonId}/rounds`);
        await delay(300);

        if (roundsData?.rounds) {
            champData.currentRound = roundsData.currentRound?.round || 1;
            champData.rounds = roundsData.rounds.map(r => r.round);
            const current = champData.currentRound;
            console.log(`  ${t.name}: ${champData.rounds.length} rounds, current: ${current}`);

            // Só buscar rodada atual ±2 (5 rodadas no máximo)
            const roundsToFetch = [];
            for (let r = current - 2; r <= current + 2; r++) {
                if (champData.rounds.includes(r)) roundsToFetch.push(r);
            }

            for (const round of roundsToFetch) {
                const matchData = await fetchAPI(`tournament/${t.id}/season/${t.seasonId}/matches/round/${round}`);
                await delay(300);
                if (matchData?.events && matchData.events.length > 0) {
                    champData.matchesByRound[round] = matchData.events.map(e => ({
                        id: e.id,
                        home: e.homeTeam?.name,
                        away: e.awayTeam?.name,
                        homeId: e.homeTeam?.id,
                        awayId: e.awayTeam?.id,
                        homeScore: e.homeScore?.current ?? null,
                        awayScore: e.awayScore?.current ?? null,
                        status: e.status?.type,
                        statusDesc: e.status?.description,
                        timestamp: e.startTimestamp,
                        round,
                    }));
                }
            }
            console.log(`    Fetched rounds: ${roundsToFetch.join(', ')} (preserved: ${Object.keys(existingMatches).length} older rounds)`);
        }

        // 2. Get standings (1 req)
        const standingsData = await fetchAPI(`tournament/${t.id}/season/${t.seasonId}/standings/total`);
        await delay(300);
        if (standingsData?.standings) {
            champData.standings = standingsData.standings.map(group => ({
                name: group.name || '',
                rows: (group.rows || []).map(r => ({
                    pos: r.position,
                    team: r.team?.name,
                    teamId: r.team?.id,
                    pts: r.points,
                    matches: r.matches,
                    wins: r.wins,
                    draws: r.draws,
                    losses: r.losses,
                    gf: r.scoresFor,
                    ga: r.scoresAgainst,
                    gd: r.scoreDiffFormatted || (r.scoresFor - r.scoresAgainst),
                    promo: r.promotion?.text || '',
                })),
            }));
            console.log(`    Standings: ${champData.standings[0]?.rows?.length || 0} teams`);
        }

        // Scorers: preservar do cache anterior (Brasileirão agora via CBF)
        if (existing.topScorers) {
            champData.topScorers = existing.topScorers;
        }

        fs.writeFileSync(cacheFile, JSON.stringify(champData));
        console.log(`    Saved: champ_${t.id}.json`);
    }

    console.log(`Done! Total API requests: ${requestCount}`);
}

main().catch(console.error);
