/* =====================================================
   PAPO DE BOLA - Configuration
   SportAPI (Sofascore) via RapidAPI
   ===================================================== */

const CONFIG = {
    // FootApi via RapidAPI (50 req/day, resets daily)
    API_BASE: 'https://footapi7.p.rapidapi.com/api',
    API_KEY: localStorage.getItem('pdb_api_key') || 'b46d00e4d2mshf5f1ff9d60f4a0dp17c20ajsnaf486faf891a',
    API_HOST: 'footapi7.p.rapidapi.com',

    // Refresh interval for live data (ms)
    REFRESH_INTERVAL: parseInt(localStorage.getItem('pdb_refresh_interval') || '300') * 1000,

    // Tournament IDs (SportAPI / Sofascore)
    TOURNAMENTS: {
        // Brasil - Nacionais
        BRASILEIRAO_A:   { id: 325,   name: 'Brasileirão Série A',   seasonId: 87678 },
        BRASILEIRAO_B:   { id: 390,   name: 'Brasileirão Série B',   seasonId: 89840 },
        BRASILEIRAO_C:   { id: 1281,  name: 'Brasileirão Série C',   seasonId: null },
        BRASILEIRAO_D:   { id: 10326, name: 'Brasileirão Série D',   seasonId: null },
        COPA_DO_BRASIL:  { id: 373,   name: 'Copa do Brasil',        seasonId: 89353 },
        COPA_NORDESTE:   { id: 1596,  name: 'Copa do Nordeste',      seasonId: 91324 },

        // Brasil - Estaduais
        PAULISTA:        { id: 372,   name: 'Paulista Série A1',     seasonId: 86993 },
        CARIOCA:         { id: 92,    name: 'Carioca',               seasonId: 86674 },
        MINEIRO:         { id: 379,   name: 'Mineiro',               seasonId: 87236 },
        GAUCHO:          { id: 377,   name: 'Gaúcho',                seasonId: 86736 },
        PARANAENSE:      { id: 382,   name: 'Paranaense',            seasonId: 86658 },
        PERNAMBUCANO:    { id: 380,   name: 'Pernambucano',          seasonId: 87395 },

        // Sul-Americano
        LIBERTADORES:    { id: 384,   name: 'Copa Libertadores',     seasonId: 87760 },
        SUDAMERICANA:    { id: 480,   name: 'Copa Sudamericana',     seasonId: 87770 },

        // Europa - UEFA
        CHAMPIONS:       { id: 7,     name: 'Champions League',      seasonId: 76953 },
        EUROPA_LEAGUE:   { id: 679,   name: 'Europa League',         seasonId: 76984 },

        // Europa - Ligas
        PREMIER:         { id: 17,    name: 'Premier League',        seasonId: 76986 },
        LA_LIGA:         { id: 8,     name: 'La Liga',               seasonId: 77559 },
        SERIE_A_IT:      { id: 23,    name: 'Serie A (Itália)',       seasonId: 76457 },
        BUNDESLIGA:      { id: 35,    name: 'Bundesliga',            seasonId: 77333 },
        LIGUE_1:         { id: 34,    name: 'Ligue 1',               seasonId: 77356 },
    },

    // Category mapping for filters
    CATEGORIES: {
        brasil: [325, 390, 1281, 10326, 373, 1596, 372, 92, 379, 377, 382, 380],
        europa: [7, 679, 17, 8, 23, 35, 34],
        sulamericano: [384, 480],
    },

    // Build lookup maps
    get TOURNAMENT_BY_ID() {
        const map = {};
        Object.values(this.TOURNAMENTS).forEach(t => { map[t.id] = t; });
        return map;
    },
};

// Helper to get league category from tournament ID
function getLeagueCategory(tournamentId) {
    for (const [cat, ids] of Object.entries(CONFIG.CATEGORIES)) {
        if (ids.includes(tournamentId)) return cat;
    }
    return 'all';
}

// Helper to get league name from tournament ID
function getLeagueName(tournamentId) {
    return CONFIG.TOURNAMENT_BY_ID[tournamentId]?.name || '';
}
