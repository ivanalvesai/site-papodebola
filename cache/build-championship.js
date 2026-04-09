#!/usr/bin/env node
/**
 * Caches championship data: rounds, standings for main tournaments
 * Runs every 3 hours
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.dirname(__filename);
const API_KEY = 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2';
const API_HOST = 'allsportsapi2.p.rapidapi.com';

const TOURNAMENTS = [
    { id: 325, seasonId: 87678, name: 'Brasileirão Série A' },
    { id: 390, seasonId: 89840, name: 'Brasileirão Série B' },
    { id: 373, seasonId: 89353, name: 'Copa do Brasil' },
    { id: 384, seasonId: 87760, name: 'Libertadores' },
    { id: 480, seasonId: 87770, name: 'Sudamericana' },
    { id: 7,  seasonId: 76953, name: 'Champions League' },
    { id: 17, seasonId: 76986, name: 'Premier League' },
    { id: 8,  seasonId: 77559, name: 'La Liga' },
];

function fetchAPI(endpoint) {
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

async function main() {
    console.log('Building championship cache...');

    for (const t of TOURNAMENTS) {
        const cacheFile = path.join(CACHE_DIR, `champ_${t.id}.json`);
        const champData = { tournament: t, rounds: null, currentRound: null, standings: null, updatedAt: new Date().toISOString() };

        // Get rounds info
        const roundsData = await fetchAPI(`tournament/${t.id}/season/${t.seasonId}/rounds`);
        if (roundsData?.rounds) {
            champData.currentRound = roundsData.currentRound?.round || 1;
            champData.rounds = roundsData.rounds.map(r => r.round);
            console.log(`  ${t.name}: ${champData.rounds.length} rounds, current: ${champData.currentRound}`);

            // Fetch ALL rounds
            const roundsToFetch = champData.rounds.slice();

            champData.matchesByRound = {};
            for (const round of roundsToFetch) {
                const matchData = await fetchAPI(`tournament/${t.id}/season/${t.seasonId}/matches/round/${round}`);
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
            console.log(`    Fetched rounds: ${roundsToFetch.join(', ')}`);
        }

        // Get standings
        const standingsData = await fetchAPI(`tournament/${t.id}/season/${t.seasonId}/standings/total`);
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

        // Get top scorers from top teams
        if (champData.standings?.[0]?.rows?.length) {
            champData.topScorers = [];
            const topTeams = champData.standings[0].rows.slice(0, 6);
            for (const row of topTeams) {
                const bp = await fetchAPI(`team/${row.teamId}/tournament/${t.id}/season/${t.seasonId}/best-players`);
                if (bp?.topPlayers?.goals) {
                    bp.topPlayers.goals.forEach(p => {
                        champData.topScorers.push({
                            name: p.player?.name || p.player?.shortName,
                            playerId: p.player?.id,
                            team: row.team,
                            teamId: row.teamId,
                            goals: p.statistics?.goals || 0,
                        });
                    });
                }
            }
            // Dedupe, sort, top 10
            const seen = new Set();
            champData.topScorers = champData.topScorers
                .filter(s => { if (seen.has(s.playerId)) return false; seen.add(s.playerId); return true; })
                .sort((a, b) => b.goals - a.goals)
                .slice(0, 10);
            console.log(`    Top scorers: ${champData.topScorers.length}`);
        }

        fs.writeFileSync(cacheFile, JSON.stringify(champData));
        console.log(`    Saved: champ_${t.id}.json`);
    }

    console.log('Done!');
}

main().catch(console.error);
