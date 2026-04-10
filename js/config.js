/* =====================================================
   PAPO DE BOLA - Configuration
   SportAPI (Sofascore) via RapidAPI
   ===================================================== */

const CONFIG = {
    // AllSportsApi via RapidAPI (Pro plan)
    API_BASE: 'https://allsportsapi2.p.rapidapi.com/api',
    API_KEY: localStorage.getItem('pdb_api_key') || 'cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2',
    API_HOST: 'allsportsapi2.p.rapidapi.com',

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

// Translate match status to PT-BR
function translateStatus(description) {
    if (!description) return '';
    const map = {
        // Status types
        '1st half': '1º Tempo',
        '2nd half': '2º Tempo',
        'Halftime': 'Intervalo',
        'Half Time': 'Intervalo',
        'HT': 'Intervalo',
        'Full Time': 'Encerrado',
        'FT': 'Encerrado',
        'Finished': 'Encerrado',
        'Not started': 'Não iniciado',
        'Postponed': 'Adiado',
        'Cancelled': 'Cancelado',
        'Suspended': 'Suspenso',
        'Interrupted': 'Interrompido',
        'Abandoned': 'Abandonado',
        'Extra Time': 'Prorrogação',
        'ET': 'Prorrogação',
        'Extra time half time': 'Intervalo Prorr.',
        'Penalties': 'Pênaltis',
        'Penalty': 'Pênaltis',
        'After Pens': 'Após Pênaltis',
        'After Extra Time': 'Após Prorrogação',
        'AET': 'Após Prorrogação',
        'Break Time': 'Intervalo',
        'Awaiting updates': 'Aguardando',
        'Live': 'Ao Vivo',
        'Ended': 'Encerrado',
        'AP': 'Após Pênaltis',
        'Started': 'Iniciado',
        'About to start': 'Prestes a iniciar',
        // Periods
        '1st period': '1º Período',
        '2nd period': '2º Período',
        '3rd period': '3º Período',
        'Overtime': 'Prorrogação',
    };
    // Exact match
    if (map[description]) return map[description];
    // Case-insensitive match
    const lower = description.toLowerCase();
    for (const [en, pt] of Object.entries(map)) {
        if (lower === en.toLowerCase()) return pt;
    }
    // Partial matches
    if (lower.includes('1st half')) return '1º Tempo';
    if (lower.includes('2nd half')) return '2º Tempo';
    if (lower.includes('half')) return 'Intervalo';
    if (lower.includes('extra')) return 'Prorrogação';
    if (lower.includes('penal')) return 'Pênaltis';
    if (lower.includes('finish') || lower.includes('ended')) return 'Encerrado';
    if (lower.includes('postpone')) return 'Adiado';
    if (lower.includes('cancel')) return 'Cancelado';
    if (lower.includes('suspend')) return 'Suspenso';
    if (lower.includes('start')) return 'Iniciado';
    // Return original if no match
    return description;
}
