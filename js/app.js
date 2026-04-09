/* =====================================================
   PAPO DE BOLA - Main Application
   Uses SportAPI (Sofascore) for real-time football data
   ===================================================== */

const App = {
    refreshTimer: null,
    currentFilter: 'all',

    init() {
        Admin.init();
        this.setupMobileMenu();
        this.setupDropdowns();
        this.setupFilters();
        this.setupSearch();
        this.setTodayDate();
        this.loadAllData();
        this.startAutoRefresh();
    },

    setupMobileMenu() {
        const btn = document.getElementById('mobileMenuBtn');
        const nav = document.getElementById('mainNav');
        if (btn && nav) {
            btn.addEventListener('click', () => {
                nav.classList.toggle('open');
                btn.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (!nav.contains(e.target) && !btn.contains(e.target)) {
                    nav.classList.remove('open');
                    btn.classList.remove('active');
                }
            });
        }
    },

    setupDropdowns() {
        if (window.innerWidth <= 768) {
            document.querySelectorAll('.nav-item.has-dropdown > .nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    link.parentElement.classList.toggle('dropdown-open');
                });
            });
        }
    },

    setupFilters() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.filterMatches(btn.dataset.filter);
            });
        });
    },

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => this.handleSearch(searchInput.value.trim()), 300);
            });
        }
    },

    setTodayDate() {
        const el = document.getElementById('todayDate');
        if (el) {
            el.textContent = new Date().toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
        }
    },

    // ==================== LOAD ALL DATA ====================
    async loadAllData() {
        const isHomePage = !window.location.pathname.includes('ao-vivo');

        if (isHomePage) {
            // Homepage: load news content
            this.loadHomeContent();
            this.loadStandings();
            this.loadTopScorers();
            this.loadTickerFromCache();
            this.loadRecentResultsFromCache();
        } else {
            // Ao Vivo page: load matches
            this.loadLivePage();
        }
    },

    // ==================== HOMEPAGE CONTENT ====================
    async loadHomeContent() {
        const homeData = await API.fetchCache('home.json');

        if (homeData) {
            this.renderHighlights(homeData.highlights || []);
            this.renderNews(homeData.news || []);
            this.renderTransfers(homeData.transfers || []);
            this.renderTopMatches(homeData.topMatches || []);
        } else {
            // Fallback: show loading messages
            const containers = ['highlightsGrid', 'newsGrid', 'transfersList', 'topMatchesScroll'];
            containers.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '<div class="no-matches"><p>Conteúdo será carregado em breve</p></div>';
            });
        }
    },

    renderHighlights(highlights) {
        const container = document.getElementById('highlightsGrid');
        if (!container || highlights.length === 0) {
            if (container) container.innerHTML = '<div class="no-matches"><i class="fas fa-video"></i><p>Nenhum destaque disponível</p></div>';
            return;
        }

        container.innerHTML = highlights.slice(0, 7).map(h => `
            <a href="${h.url}" target="_blank" rel="noopener" class="highlight-card">
                <div class="highlight-thumb">
                    ${h.thumbnail ? `<img src="${h.thumbnail}" alt="${h.title}" loading="lazy">` : ''}
                    <div class="play-icon"><i class="fas fa-play-circle"></i></div>
                </div>
                <div class="highlight-body">
                    <div class="highlight-team">${h.team}</div>
                    <div class="highlight-title">${h.title}</div>
                    ${h.subtitle ? `<div class="highlight-subtitle">${h.subtitle}</div>` : ''}
                </div>
            </a>
        `).join('');
    },

    renderNews(news) {
        const container = document.getElementById('newsGrid');
        if (!container || news.length === 0) {
            if (container) container.innerHTML = '<div class="no-matches"><i class="fas fa-newspaper"></i><p>Nenhuma notícia disponível</p></div>';
            return;
        }

        container.innerHTML = news.slice(0, 7).map(n => {
            const isLocal = n.local || n.link?.startsWith('/artigos');
            const href = isLocal ? n.link : n.link;
            const target = isLocal ? '' : 'target="_blank" rel="noopener"';
            const dateStr = n.pubDate ? new Date(n.pubDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

            return `
                <a href="${href}" ${target} class="news-card">
                    <div class="news-thumb">
                        ${n.image ? `<img src="${n.image}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-newspaper\\'></i>'">` : '<i class="fas fa-newspaper"></i>'}
                    </div>
                    <div class="news-body">
                        <div class="news-source">Papo de Bola</div>
                        <div class="news-title">${n.title}</div>
                        <div class="news-desc">${n.description || ''}</div>
                        ${dateStr ? `<div class="news-date">${dateStr}</div>` : ''}
                    </div>
                </a>
            `;
        }).join('');
    },

    renderTransfers(transfers) {
        const container = document.getElementById('transfersList');
        if (!container || transfers.length === 0) {
            if (container) container.innerHTML = '<div class="no-matches"><i class="fas fa-exchange-alt"></i><p>Nenhuma transferência recente</p></div>';
            return;
        }

        container.innerHTML = transfers.slice(0, 10).map(t => {
            const feeDisplay = t.fee ? (typeof t.fee === 'number' ? `€${(t.fee / 1000000).toFixed(1)}M` : t.fee) : 'Sem custo';

            return `
                <div class="transfer-item">
                    <div class="transfer-photo">
                        ${t.playerId ? `<img src="/img/player/${t.playerId}/image" alt="${t.player}" onerror="this.outerHTML='<i class=\\'fas fa-user\\'></i>'">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="transfer-info">
                        <div class="transfer-player">${t.player}</div>
                        <div class="transfer-details">
                            <span>${t.fromTeam || '?'}</span>
                            <i class="fas fa-arrow-right transfer-arrow"></i>
                            <span><strong>${t.toTeam}</strong></span>
                        </div>
                    </div>
                    <div class="transfer-meta">
                        <div class="transfer-fee">${feeDisplay}</div>
                        <div class="transfer-type">${t.type}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderTopMatches(matches) {
        const container = document.getElementById('topMatchesScroll');
        if (!container || matches.length === 0) {
            if (container) container.parentElement.style.display = 'none';
            return;
        }

        container.innerHTML = matches.map(m => {
            const isLive = m.status === 'inprogress';
            const isFinished = m.status === 'finished';
            const hasScore = m.homeScore !== null;

            return `
                <div class="top-match-card ${isLive ? 'is-live' : ''}">
                    <div class="top-match-league">${m.league}</div>
                    <div class="top-match-teams">
                        ${m.homeId ? `<img src="/img/team/${m.homeId}/image" alt="" onerror="this.style.display='none'">` : ''}
                        <span>${m.home}</span>
                        ${hasScore
                            ? `<span class="top-match-score">${m.homeScore} - ${m.awayScore}</span>`
                            : `<span class="top-match-time">${m.time}</span>`
                        }
                        <span>${m.away}</span>
                        ${m.awayId ? `<img src="/img/team/${m.awayId}/image" alt="" onerror="this.style.display='none'">` : ''}
                    </div>
                    ${isLive ? '<div class="top-match-status">AO VIVO</div>' : ''}
                    ${isFinished ? '<div class="top-match-time">Encerrado</div>' : ''}
                </div>
            `;
        }).join('');
    },

    async loadTickerFromCache() {
        const cached = await API.fetchCache('live.json');
        if (cached?.events) {
            const liveGames = cached.events.slice(0, 20).map(e => API.normalizeEvent(e));
            this.renderTicker(liveGames);
        }
    },

    async loadRecentResultsFromCache() {
        const cached = await API.fetchCache('today.json');
        if (cached?.events) {
            const todayGames = cached.events.map(e => API.normalizeEvent(e));
            this.loadRecentResults(todayGames);
        }
    },

    // ==================== AO VIVO PAGE ====================
    async loadLivePage() {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const manualGames = GamesDB.getAll();

        const [liveEvents, todayEvents] = await Promise.all([
            API.getLiveEvents(),
            API.getTodayEvents(),
        ]);

        const normalizedLive = liveEvents.map(e => API.normalizeEvent(e));
        const normalizedToday = todayEvents.map(e => API.normalizeEvent(e));

        const manualNormalized = manualGames.map(g => ({
            id: g.id, league: g.league, leagueId: g.leagueId || 0, country: 'Manual',
            homeTeam: g.homeTeam, awayTeam: g.awayTeam,
            homeScore: g.homeScore || 0, awayScore: g.awayScore || 0,
            homeLogo: null, awayLogo: null, time: g.time, date: g.date,
            status: g.status, statusText: g.status === 'live' ? 'AO VIVO' : g.status === 'finished' ? 'Encerrado' : '',
            minute: g.minute || '', embeds: g.embeds || [],
            isManual: true, category: getLeagueCategory(g.leagueId || 0), featured: g.featured,
        }));

        const manualLive = manualNormalized.filter(g => g.status === 'live');
        const allLive = [...manualLive, ...normalizedLive];
        const manualToday = manualNormalized.filter(g => g.date === today);
        const allToday = [...manualToday, ...normalizedToday];

        this.renderLiveMatches(allLive);
        this.renderTodayMatches(allToday);
        this.renderTicker(allLive);

        this.loadStandings();

        const tomorrowEvents = await API.getTomorrowEvents();
        const normalizedTomorrow = tomorrowEvents.map(e => API.normalizeEvent(e));
        const manualTomorrow = manualNormalized.filter(g => g.date === tomorrow);
        this.renderTomorrowMatches([...manualTomorrow, ...normalizedTomorrow]);
    },

    // ==================== RENDER LIVE ====================
    renderLiveMatches(games) {
        const container = document.getElementById('liveMatches');
        if (games.length === 0) {
            container.innerHTML = `
                <div class="no-matches">
                    <i class="fas fa-tv"></i>
                    <p>Nenhum jogo ao vivo no momento</p>
                </div>`;
            return;
        }
        container.innerHTML = this.renderMatchGroups(games);
    },

    // ==================== RENDER TODAY ====================
    renderTodayMatches(games) {
        const container = document.getElementById('todayMatches');
        if (games.length === 0) {
            container.innerHTML = `
                <div class="no-matches">
                    <i class="fas fa-calendar-times"></i>
                    <p>Nenhum jogo encontrado para hoje</p>
                </div>`;
            return;
        }
        container.innerHTML = this.renderMatchGroups(games);
        // Apply current filter
        if (this.currentFilter !== 'all') {
            this.filterMatches(this.currentFilter);
        }
    },

    // ==================== RENDER TOMORROW ====================
    renderTomorrowMatches(games) {
        const container = document.getElementById('tomorrowMatches');
        if (games.length === 0) {
            container.innerHTML = `
                <div class="no-matches">
                    <i class="fas fa-calendar-times"></i>
                    <p>Nenhum jogo encontrado para amanhã</p>
                </div>`;
            return;
        }
        container.innerHTML = this.renderMatchGroups(games);
    },

    // ==================== GROUP & RENDER ====================
    renderMatchGroups(games) {
        const groups = {};
        games.forEach(g => {
            const key = g.league || 'Outros';
            if (!groups[key]) {
                groups[key] = { league: g.league, leagueId: g.leagueId, country: g.country, category: g.category, games: [] };
            }
            groups[key].games.push(g);
        });

        // Sort: Brasil first, then South America, then Europe, then rest
        const catOrder = { brasil: 0, sulamericano: 1, europa: 2, all: 3 };
        const sorted = Object.values(groups).sort((a, b) => (catOrder[a.category] ?? 3) - (catOrder[b.category] ?? 3));

        return sorted.map(group => `
            <div class="league-group" data-category="${group.category}">
                <div class="league-header">
                    <span class="league-header-icon"><i class="fas fa-trophy"></i></span>
                    <span class="league-header-name">${group.league}</span>
                    <span class="league-header-country">${group.country || ''}</span>
                </div>
                ${group.games.map(g => this.renderMatchCard(g)).join('')}
            </div>
        `).join('');
    },

    renderMatchCard(game) {
        const isLive = game.status === 'live' || game.status === 'halftime';
        const isFinished = game.status === 'finished';
        const hasEmbeds = game.embeds && game.embeds.length > 0;

        let statusHtml = '';
        if (game.status === 'halftime') {
            statusHtml = '<span class="match-status halftime">INTERVALO</span>';
        } else if (isLive) {
            statusHtml = `<span class="match-status live"><span class="live-dot"></span> ${game.minute || game.statusText || 'AO VIVO'}</span>`;
        } else if (isFinished) {
            statusHtml = `<span class="match-status finished">${game.statusText || 'ENCERRADO'}</span>`;
        } else if (game.status === 'postponed') {
            statusHtml = '<span class="match-status finished">ADIADO</span>';
        }

        let centerHtml;
        if (isLive || isFinished) {
            centerHtml = `<span class="match-score">${game.homeScore} - ${game.awayScore}</span>${statusHtml}`;
        } else {
            centerHtml = `<span class="match-time">${game.time}</span>${statusHtml}`;
        }

        const homeLogo = game.homeLogo
            ? `<img class="match-team-logo" src="${game.homeLogo}" alt="${game.homeTeam}" loading="lazy" onerror="this.style.display='none'">`
            : '<span class="match-team-logo-placeholder"><i class="fas fa-shield-alt"></i></span>';
        const awayLogo = game.awayLogo
            ? `<img class="match-team-logo" src="${game.awayLogo}" alt="${game.awayTeam}" loading="lazy" onerror="this.style.display='none'">`
            : '<span class="match-team-logo-placeholder"><i class="fas fa-shield-alt"></i></span>';

        return `
            <div class="match-card ${isLive ? 'is-live' : ''}" data-category="${game.category}" data-id="${game.id}">
                <div class="match-team home">
                    ${homeLogo}
                    <span>${game.homeTeam}</span>
                </div>
                <div class="match-center">
                    ${centerHtml}
                </div>
                <div class="match-team away">
                    <span>${game.awayTeam}</span>
                    ${awayLogo}
                </div>
                <div class="match-actions">
                    ${hasEmbeds ? `
                        <button class="match-watch-btn" onclick="App.openWatch('${game.id}')">
                            <i class="fas fa-play"></i> ASSISTIR
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // ==================== TICKER ====================
    renderTicker(liveGames) {
        const track = document.getElementById('tickerTrack');
        const tickerBar = document.getElementById('tickerBar');

        if (liveGames.length === 0) {
            tickerBar.style.display = 'none';
            return;
        }

        tickerBar.style.display = 'block';

        const items = liveGames.map(g => `
            <div class="ticker-item">
                <span class="ticker-league">${g.league}</span>
                <span>${g.homeTeam}</span>
                <span class="ticker-score">${g.homeScore} - ${g.awayScore}</span>
                <span>${g.awayTeam}</span>
                <span class="ticker-live">${g.minute || 'AO VIVO'}</span>
            </div>
        `).join('');

        track.innerHTML = items + items; // duplicate for seamless scroll
    },

    // ==================== FEATURED ====================
    renderFeatured(manualGames) {
        const featured = manualGames.find(g => g.featured && g.status !== 'finished');
        const section = document.getElementById('featuredSection');
        const container = document.getElementById('featuredMatch');

        if (!featured) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        const isLive = featured.status === 'live';
        const hasEmbeds = featured.embeds && featured.embeds.length > 0;

        container.innerHTML = `
            <span class="featured-badge"><i class="fas fa-star"></i> EM DESTAQUE</span>
            <div class="featured-league">${featured.league}</div>
            <div class="featured-teams">
                <div class="featured-team">
                    <div class="featured-team-logo"><i class="fas fa-shield-alt"></i></div>
                    <span class="featured-team-name">${featured.homeTeam}</span>
                </div>
                <div class="featured-score">
                    <span class="featured-score-num">${featured.homeScore}</span>
                    <span class="featured-score-sep">:</span>
                    <span class="featured-score-num">${featured.awayScore}</span>
                </div>
                <div class="featured-team">
                    <div class="featured-team-logo"><i class="fas fa-shield-alt"></i></div>
                    <span class="featured-team-name">${featured.awayTeam}</span>
                </div>
            </div>
            <div class="featured-status">
                ${isLive
                    ? `<span class="status-live"><span class="live-dot"></span> AO VIVO ${featured.minute || ''}</span>`
                    : `<span style="color:var(--text-muted)">${featured.time}</span>`
                }
            </div>
            ${hasEmbeds ? `
                <div style="text-align:center">
                    <button class="featured-watch-btn" onclick="App.openWatch('${featured.id}')">
                        <i class="fas fa-play-circle"></i> ASSISTIR AGORA
                    </button>
                </div>
            ` : ''}
        `;
    },

    // ==================== SIDEBAR: STANDINGS ====================
    async loadStandings() {
        const container = document.getElementById('standingsBrasileirao');
        const t = CONFIG.TOURNAMENTS.BRASILEIRAO_A;

        const standings = await API.getStandings(t.id, t.seasonId);

        if (!standings || standings.length === 0) {
            container.innerHTML = '<div class="no-matches"><p>Classificação indisponível</p></div>';
            return;
        }

        const rows = standings[0]?.rows?.slice(0, 10) || [];

        let html = `
            <table>
                <thead><tr>
                    <th style="text-align:left">Time</th>
                    <th>P</th>
                    <th>J</th>
                    <th>V</th>
                    <th>SG</th>
                </tr></thead>
                <tbody>
        `;

        rows.forEach((r, i) => {
            const pos = i + 1;
            let rowClass = '';
            if (pos <= 4) rowClass = 'libertadores';
            else if (pos <= 6) rowClass = 'sulamericana';

            const teamLogo = r.team?.id ? `<img src="/img/team/${r.team.id}/image" alt="" loading="lazy" onerror="this.style.display='none'" style="width:18px;height:18px">` : '';

            html += `
                <tr class="${rowClass}">
                    <td><span class="team-name"><span class="pos">${pos}</span>${teamLogo} ${r.team?.name || ''}</span></td>
                    <td class="pts">${r.points}</td>
                    <td>${r.matches}</td>
                    <td>${r.wins}</td>
                    <td>${r.scoreDiffFormatted || (r.scoresFor - r.scoresAgainst)}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // ==================== SIDEBAR: TOP SCORERS ====================
    async loadTopScorers() {
        const container = document.getElementById('topScorers');

        // Read from consolidated cache
        const cached = await API.fetchCache('scorers_brasileirao.json');

        if (!cached?.topScorers || cached.topScorers.length === 0) {
            container.innerHTML = '<div class="no-matches"><p>Artilharia indisponível</p></div>';
            return;
        }

        container.innerHTML = cached.topScorers.slice(0, 8).map((item, i) => {
            const player = item.player || {};
            const team = item.team || {};
            const goals = item.goals || 0;

            return `
                <div class="scorer-item">
                    <span class="scorer-rank ${i < 3 ? 'top-3' : ''}">${i + 1}</span>
                    <div class="scorer-photo" style="display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-muted)">
                        ${player.id ? `<img src="/img/player/${player.id}/image" alt="${player.name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" onerror="this.outerHTML='<i class=\\'fas fa-user\\'></i>'">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="scorer-info">
                        <div class="scorer-name">${player.name || player.shortName || '?'}</div>
                        <div class="scorer-team">${team.name || ''}</div>
                    </div>
                    <span class="scorer-goals">${goals}</span>
                </div>
            `;
        }).join('');
    },

    // ==================== SIDEBAR: RECENT RESULTS ====================
    loadRecentResults(todayGames) {
        const container = document.getElementById('recentResults');
        const finished = todayGames.filter(g => g.status === 'finished').slice(0, 6);

        if (finished.length === 0) {
            container.innerHTML = '<div class="no-matches"><p>Nenhum resultado recente</p></div>';
            return;
        }

        container.innerHTML = finished.map(g => `
            <div class="result-item">
                <div class="result-teams"><span>${g.homeTeam}</span></div>
                <span class="result-score">${g.homeScore} - ${g.awayScore}</span>
                <div class="result-teams"><span>${g.awayTeam}</span></div>
                <span class="result-league">${g.league}</span>
            </div>
        `).join('');
    },

    // ==================== WATCH MODAL ====================
    openWatch(gameId) {
        let game = GamesDB.getById(gameId);
        if (!game || !game.embeds || game.embeds.length === 0) {
            showToast('Nenhum link de transmissão disponível para este jogo.', 'error');
            return;
        }

        let overlay = document.querySelector('.watch-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'watch-modal-overlay';
            document.body.appendChild(overlay);
        }

        const isLive = game.status === 'live';

        overlay.innerHTML = `
            <div class="watch-modal">
                <div class="watch-header">
                    <div class="watch-match-info">
                        <span class="watch-league">${game.league}</span>
                        <span class="watch-teams">${game.homeTeam} vs ${game.awayTeam}</span>
                        ${isLive ? `<span class="watch-score">${game.homeScore} - ${game.awayScore}</span>` : ''}
                    </div>
                    <button class="watch-close" onclick="App.closeWatch()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="player-options">
                    ${game.embeds.map((embed, i) => `
                        <button class="player-option-btn ${i === 0 ? 'active' : ''}"
                                data-src="${embed.url}"
                                onclick="App.switchPlayer(this)">
                            ${embed.name || `Opção ${i + 1}`}
                        </button>
                    `).join('')}
                </div>
                <div class="player-container" id="playerContainer">
                    ${game.embeds[0].url
                        ? `<iframe src="${game.embeds[0].url}" allowfullscreen allow="autoplay; encrypted-media; fullscreen" scrolling="no"></iframe>`
                        : `<div class="player-placeholder">
                            <i class="fas fa-play-circle"></i>
                            <p>Link de transmissão não configurado</p>
                            <p style="font-size:13px">Adicione URLs de embed no painel admin</p>
                          </div>`
                    }
                </div>
                <div class="watch-details">
                    <div style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px">
                        <p><i class="fas fa-info-circle"></i> Se o player não carregar, tente outra opção acima.</p>
                    </div>
                </div>
            </div>
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeWatch();
        });

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeWatch();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    switchPlayer(btn) {
        document.querySelectorAll('.player-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const src = btn.dataset.src;
        const container = document.getElementById('playerContainer');
        if (src) {
            container.innerHTML = `<iframe src="${src}" allowfullscreen allow="autoplay; encrypted-media; fullscreen" scrolling="no"></iframe>`;
        } else {
            container.innerHTML = '<div class="player-placeholder"><i class="fas fa-play-circle"></i><p>Link não configurado</p></div>';
        }
    },

    closeWatch() {
        const overlay = document.querySelector('.watch-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            const container = document.getElementById('playerContainer');
            if (container) container.innerHTML = '';
            document.body.style.overflow = '';
        }
    },

    // ==================== FILTER & SEARCH ====================
    filterMatches(category) {
        const groups = document.querySelectorAll('#todayMatches .league-group');
        groups.forEach(group => {
            if (category === 'all') {
                group.style.display = 'block';
            } else {
                group.style.display = group.dataset.category === category ? 'block' : 'none';
            }
        });
    },

    handleSearch(query) {
        if (!query) {
            document.querySelectorAll('.match-card').forEach(c => c.style.display = '');
            document.querySelectorAll('.league-group').forEach(g => g.style.display = '');
            return;
        }
        const lower = query.toLowerCase();
        document.querySelectorAll('.league-group').forEach(group => {
            let hasVisible = false;
            group.querySelectorAll('.match-card').forEach(card => {
                const text = card.textContent.toLowerCase();
                const visible = text.includes(lower);
                card.style.display = visible ? '' : 'none';
                if (visible) hasVisible = true;
            });
            group.style.display = hasVisible ? '' : 'none';
        });
    },

    // ==================== AUTO REFRESH ====================
    startAutoRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => this.loadAllData(), CONFIG.REFRESH_INTERVAL);
    },
};

// Initialize
document.addEventListener('DOMContentLoaded', () => App.init());
