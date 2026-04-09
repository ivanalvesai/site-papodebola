/* =====================================================
   PAPO DE BOLA - API Layer
   SportAPI (Sofascore data) via RapidAPI
   ===================================================== */

const API = {
    // Generic fetch from SportAPI
    async fetch(endpoint) {
        if (!CONFIG.API_KEY) {
            console.warn('API Key não configurada.');
            return null;
        }

        const url = `${CONFIG.API_BASE}/${endpoint}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-rapidapi-key': CONFIG.API_KEY,
                    'x-rapidapi-host': CONFIG.API_HOST,
                    'Accept': 'application/json',
                },
            });

            if (response.status === 204) return null;
            if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);

            const data = await response.json();

            if (data.error) {
                console.error('API Error:', data.error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('API fetch error:', error);
            return null;
        }
    },

    // ==================== LIVE ====================
    async getLiveEvents() {
        const data = await this.fetch('sport/football/events/live');
        return data?.events || [];
    },

    // ==================== SCHEDULED ====================
    async getEventsByDate(dateStr) {
        // dateStr format: YYYY-MM-DD
        const [y, m, d] = dateStr.split('-');
        const data = await this.fetch(`sport/football/scheduled-events/${y}-${m}-${d}`);
        return data?.events || [];
    },

    // ==================== STANDINGS ====================
    async getStandings(tournamentId, seasonId) {
        const data = await this.fetch(`unique-tournament/${tournamentId}/season/${seasonId}/standings/total`);
        return data?.standings || null;
    },

    // ==================== TOURNAMENT EVENTS ====================
    async getTournamentLastEvents(tournamentId, seasonId, page = 0) {
        const data = await this.fetch(`unique-tournament/${tournamentId}/season/${seasonId}/events/last/${page}`);
        return data?.events || [];
    },

    async getTournamentNextEvents(tournamentId, seasonId, page = 0) {
        const data = await this.fetch(`unique-tournament/${tournamentId}/season/${seasonId}/events/next/${page}`);
        return data?.events || [];
    },

    // ==================== STATISTICS (Top Scorers) ====================
    async getStatistics(tournamentId, seasonId) {
        const data = await this.fetch(`unique-tournament/${tournamentId}/season/${seasonId}/statistics`);
        return data?.results || null;
    },

    // ==================== TOURNAMENT INFO ====================
    async getTournamentInfo(tournamentId, seasonId) {
        const data = await this.fetch(`unique-tournament/${tournamentId}/season/${seasonId}/info`);
        return data?.info || null;
    },

    // ==================== TOURNAMENT SEASONS ====================
    async getTournamentSeasons(tournamentId) {
        const data = await this.fetch(`unique-tournament/${tournamentId}/seasons`);
        return data?.seasons || [];
    },

    // ==================== EVENT DETAILS ====================
    async getEventDetails(eventId) {
        const data = await this.fetch(`event/${eventId}`);
        return data?.event || null;
    },

    async getEventLineups(eventId) {
        const data = await this.fetch(`event/${eventId}/lineups`);
        return data;
    },

    async getEventStatistics(eventId) {
        const data = await this.fetch(`event/${eventId}/statistics`);
        return data?.statistics || null;
    },

    async getEventIncidents(eventId) {
        const data = await this.fetch(`event/${eventId}/incidents`);
        return data?.incidents || [];
    },

    // ==================== SEARCH ====================
    async search(query) {
        const data = await this.fetch(`search/${encodeURIComponent(query)}`);
        return data?.results || [];
    },

    // ==================== HELPERS ====================
    // Normalize a SportAPI event to our standard format
    normalizeEvent(event) {
        const status = this.mapStatus(event.status);
        const tournamentId = event.tournament?.uniqueTournament?.id;
        const startTime = event.startTimestamp ? new Date(event.startTimestamp * 1000) : null;

        return {
            id: `api_${event.id}`,
            apiId: event.id,
            league: event.tournament?.uniqueTournament?.name || event.tournament?.name || 'Desconhecido',
            leagueId: tournamentId,
            leagueSlug: event.tournament?.uniqueTournament?.slug,
            country: event.tournament?.category?.name,
            countryFlag: event.tournament?.category?.alpha2,
            homeTeam: event.homeTeam?.name || 'TBD',
            awayTeam: event.awayTeam?.name || 'TBD',
            homeScore: event.homeScore?.current ?? event.homeScore?.display ?? 0,
            awayScore: event.awayScore?.current ?? event.awayScore?.display ?? 0,
            homeLogo: event.homeTeam?.id ? `https://api.sofascore.app/api/v1/team/${event.homeTeam.id}/image` : null,
            awayLogo: event.awayTeam?.id ? `https://api.sofascore.app/api/v1/team/${event.awayTeam.id}/image` : null,
            time: startTime ? startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
            date: startTime ? startTime.toISOString().split('T')[0] : '',
            status: status.type,
            statusText: status.text,
            minute: event.statusTime?.played ? `${event.statusTime.played}'` : (event.status?.description || ''),
            embeds: [],
            isManual: false,
            category: getLeagueCategory(tournamentId),
        };
    },

    // Map SportAPI status to our format
    mapStatus(status) {
        if (!status) return { type: 'scheduled', text: '' };

        const type = status.type;
        const code = status.code;
        const desc = status.description;

        if (type === 'inprogress') {
            if (code === 6) return { type: 'live', text: '1º Tempo' };
            if (code === 7) return { type: 'live', text: '2º Tempo' };
            if (code === 41) return { type: 'live', text: 'Prorrogação' };
            return { type: 'live', text: desc || 'AO VIVO' };
        }
        if (type === 'finished') {
            if (code === 120) return { type: 'finished', text: 'AP' };
            if (code === 110) return { type: 'finished', text: 'Pen.' };
            return { type: 'finished', text: 'Encerrado' };
        }
        if (code === 31) return { type: 'halftime', text: 'Intervalo' };
        if (type === 'notstarted') return { type: 'scheduled', text: '' };
        if (type === 'postponed') return { type: 'postponed', text: 'Adiado' };
        if (type === 'canceled') return { type: 'cancelled', text: 'Cancelado' };

        return { type: 'scheduled', text: desc || '' };
    },
};

/* =====================================================
   LOCAL STORAGE - Manual Games Management
   ===================================================== */
const GamesDB = {
    STORAGE_KEY: 'pdb_games',

    getAll() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    save(games) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(games));
    },

    add(game) {
        const games = this.getAll();
        game.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        game.createdAt = new Date().toISOString();
        games.push(game);
        this.save(games);
        return game;
    },

    update(id, updates) {
        const games = this.getAll();
        const index = games.findIndex(g => g.id === id);
        if (index > -1) {
            games[index] = { ...games[index], ...updates };
            this.save(games);
            return games[index];
        }
        return null;
    },

    delete(id) {
        const games = this.getAll();
        this.save(games.filter(g => g.id !== id));
    },

    getById(id) {
        return this.getAll().find(g => g.id === id);
    },

    getLive() {
        return this.getAll().filter(g => g.status === 'live');
    },

    getByDate(date) {
        return this.getAll().filter(g => g.date === date);
    },

    getFeatured() {
        return this.getAll().find(g => g.featured && g.status !== 'finished');
    },
};
