#!/usr/bin/env node
/**
 * Builds homepage content: highlights, transfers, news from RSS
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.dirname(__filename);
const API_KEY = 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2';
const API_HOST = 'allsportsapi2.p.rapidapi.com';

// Top Brazilian teams (IDs from Sofascore)
const BR_TEAMS = [
    { id: 1963, name: 'Palmeiras' },
    { id: 5981, name: 'Flamengo' },
    { id: 1981, name: 'São Paulo' },
    { id: 1961, name: 'Fluminense' },
    { id: 1957, name: 'Corinthians' },
    { id: 1955, name: 'Bahia' },
    { id: 1967, name: 'Athletico' },
    { id: 1977, name: 'Atlético Mineiro' },
    { id: 1958, name: 'Botafogo' },
    { id: 1954, name: 'Grêmio' },
    { id: 1968, name: 'Santos' },
    { id: 1952, name: 'Vasco' },
    { id: 1959, name: 'Internacional' },
    { id: 1982, name: 'Cruzeiro' },
    { id: 1962, name: 'Fortaleza' },
];

function fetchAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            path: `/api/${endpoint}`,
            headers: {
                'x-rapidapi-key': API_KEY,
                'x-rapidapi-host': API_HOST,
            },
        };
        https.get(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function fetchRSS(url) {
    return new Promise((resolve) => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
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
        // Try to extract image
        let image = '';
        const imgMatch = content.match(/<media:content[^>]+url="([^"]+)"/) ||
                         content.match(/<enclosure[^>]+url="([^"]+)"/) ||
                         content.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) image = imgMatch[1];

        items.push({
            title: get('title'),
            link: get('link'),
            description: get('description').replace(/<[^>]+>/g, '').substring(0, 200),
            pubDate: get('pubDate'),
            image,
        });
    }
    return items;
}

async function main() {
    console.log('Building homepage content...');
    const homeData = {
        highlights: [],
        transfers: [],
        news: [],
        topMatches: [],
        updatedAt: new Date().toISOString(),
    };

    // 1. Get highlights from top 6 teams
    console.log('\n--- Highlights ---');
    const highlightTeams = BR_TEAMS.slice(0, 6);
    for (const team of highlightTeams) {
        const data = await fetchAPI(`team/${team.id}/media`);
        if (data?.media) {
            data.media.slice(0, 3).forEach(m => {
                if (m.mediaType === 6 || m.url?.includes('youtube')) { // Video highlights
                    homeData.highlights.push({
                        title: m.title || '',
                        subtitle: m.subtitle || '',
                        thumbnail: m.thumbnailUrl || '',
                        url: m.url || m.sourceUrl || '',
                        team: team.name,
                        teamId: team.id,
                        date: m.createdAtTimestamp ? new Date(m.createdAtTimestamp * 1000).toISOString() : '',
                    });
                }
            });
        }
        console.log(`  ${team.name}: ${data?.media?.length || 0} media items`);
    }
    // Dedupe and sort by date
    const seen = new Set();
    homeData.highlights = homeData.highlights
        .filter(h => { if (seen.has(h.title)) return false; seen.add(h.title); return true; })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 12);

    // 2. Get transfers from top 8 teams
    console.log('\n--- Transfers ---');
    const transferTeams = BR_TEAMS.slice(0, 8);
    for (const team of transferTeams) {
        const data = await fetchAPI(`team/${team.id}/transfers`);
        if (data?.transfersIn) {
            data.transfersIn.slice(0, 3).forEach(t => {
                homeData.transfers.push({
                    player: t.player?.name || '',
                    playerId: t.player?.id || 0,
                    position: t.player?.position || '',
                    fromTeam: t.transferFrom?.name || '',
                    toTeam: team.name,
                    toTeamId: team.id,
                    fee: t.transferFeeDescription || t.transferFee?.value || '',
                    feeCurrency: t.transferFee?.currency || '',
                    type: t.type === 1 ? 'Compra' : t.type === 2 ? 'Empréstimo' : t.type === 3 ? 'Fim de empréstimo' : 'Transferência',
                    date: t.transferDateTimestamp ? new Date(t.transferDateTimestamp * 1000).toISOString() : '',
                });
            });
        }
        console.log(`  ${team.name}: ${data?.transfersIn?.length || 0} in, ${data?.transfersOut?.length || 0} out`);
    }
    homeData.transfers.sort((a, b) => new Date(b.date) - new Date(a.date));
    homeData.transfers = homeData.transfers.slice(0, 15);

    // 3. Get news from RSS
    console.log('\n--- News RSS ---');
    const feeds = [
        'https://www.gazetaesportiva.com/feed/',
        'https://www.torcedores.com/feed',
    ];

    for (const feed of feeds) {
        try {
            const xml = await fetchRSS(feed);
            if (xml && xml.includes('<item>')) {
                const items = parseRSS(xml);
                homeData.news.push(...items.slice(0, 8));
                console.log(`  ${feed}: ${items.length} articles`);
            } else {
                console.log(`  ${feed}: no data`);
            }
        } catch(e) {
            console.log(`  ${feed}: error - ${e.message}`);
        }
    }
    homeData.news = homeData.news.slice(0, 15);

    // 4. Top matches of the day
    console.log('\n--- Top Matches ---');
    const now = new Date();
    const d = now.getDate(), m = now.getMonth() + 1, y = now.getFullYear();
    const topData = await fetchAPI(`matches/top/${d}/${m}/${y}`);
    if (topData?.events) {
        homeData.topMatches = topData.events.slice(0, 10).map(e => ({
            id: e.id,
            home: e.homeTeam?.name,
            away: e.awayTeam?.name,
            homeId: e.homeTeam?.id,
            awayId: e.awayTeam?.id,
            homeScore: e.homeScore?.current ?? null,
            awayScore: e.awayScore?.current ?? null,
            league: e.tournament?.uniqueTournament?.name || e.tournament?.name,
            status: e.status?.type,
            time: e.startTimestamp ? new Date(e.startTimestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
        }));
        console.log(`  ${topData.events.length} top matches`);
    }

    // Save
    const output = path.join(CACHE_DIR, 'home.json');
    fs.writeFileSync(output, JSON.stringify(homeData));
    console.log(`\nSaved: home.json (${fs.statSync(output).size} bytes)`);
    console.log(`Highlights: ${homeData.highlights.length}, Transfers: ${homeData.transfers.length}, News: ${homeData.news.length}, Top: ${homeData.topMatches.length}`);
}

main().catch(console.error);
