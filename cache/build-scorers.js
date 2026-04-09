#!/usr/bin/env node
/**
 * Busca artilheiros dos top 10 times do Brasileirão
 * e consolida em um arquivo JSON único
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.dirname(__filename);
const API_KEY = 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2';
const API_HOST = 'allsportsapi2.p.rapidapi.com';

function fetchJSON(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            path: `/api/${endpoint}`,
            headers: {
                'x-rapidapi-key': API_KEY,
                'x-rapidapi-host': API_HOST,
                'Accept': 'application/json',
            },
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        // Read standings to get team IDs
        const standingsFile = path.join(CACHE_DIR, 'standings_brasileirao.json');
        if (!fs.existsSync(standingsFile)) {
            console.error('standings_brasileirao.json not found');
            process.exit(1);
        }

        const standings = JSON.parse(fs.readFileSync(standingsFile, 'utf8'));
        const teamIds = standings.standings[0].rows.slice(0, 10).map(r => ({
            id: r.team.id,
            name: r.team.name,
        }));

        console.log(`Fetching scorers for ${teamIds.length} teams...`);

        const allScorers = [];

        for (const team of teamIds) {
            try {
                const data = await fetchJSON(`team/${team.id}/tournament/325/season/87678/best-players`);
                if (data.topPlayers?.goals) {
                    data.topPlayers.goals.forEach(p => {
                        allScorers.push({
                            player: {
                                id: p.player.id,
                                name: p.player.name,
                                shortName: p.player.shortName || p.player.name,
                            },
                            team: {
                                id: team.id,
                                name: team.name,
                            },
                            goals: p.statistics?.goals || 0,
                            rating: p.statistics?.rating || null,
                        });
                    });
                }
                console.log(`  OK: ${team.name} (${data.topPlayers?.goals?.length || 0} scorers)`);
            } catch (e) {
                console.error(`  FAIL: ${team.name}:`, e.message);
            }
        }

        // Sort by goals descending, deduplicate
        allScorers.sort((a, b) => b.goals - a.goals);
        const unique = [];
        const seen = new Set();
        for (const s of allScorers) {
            if (!seen.has(s.player.id)) {
                seen.add(s.player.id);
                unique.push(s);
            }
        }

        const result = { topScorers: unique.slice(0, 15) };
        const outputFile = path.join(CACHE_DIR, 'scorers_brasileirao.json');
        fs.writeFileSync(outputFile, JSON.stringify(result));

        console.log(`\nSaved ${unique.length} unique scorers (top 15) to scorers_brasileirao.json`);
        unique.slice(0, 8).forEach((s, i) =>
            console.log(`  ${i + 1}. ${s.player.name} | ${s.team.name} | ${s.goals} gols`)
        );
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

main();
