/**
 * Shared navigation - injects the full menu into all pages
 * Include this script in any page to get the complete nav
 */
(function() {
    const isSubpage = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/artigos/');
    const prefix = isSubpage ? '../' : '';

    const navHTML = `
        <li class="nav-item">
            <a href="#" class="nav-link" onclick="toggleTeamsPanel();return false"><i class="fas fa-bars" style="margin-right:3px"></i> Menu</a>
        </li>
        <li class="nav-item">
            <a href="${prefix}index.html" class="nav-link">Início</a>
        </li>
        <li class="nav-item has-dropdown">
            <a href="#" class="nav-link">Brasil <i class="fas fa-chevron-down"></i></a>
            <div class="dropdown-menu mega-menu">
                <div class="mega-col">
                    <h4>Campeonatos Nacionais</h4>
                    <ul>
                        <li><a href="${prefix}pages/campeonato.html?id=325&name=Brasileirão Série A">Brasileirão Série A</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=390&name=Brasileirão Série B">Brasileirão Série B</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=373&name=Copa do Brasil">Copa do Brasil</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=1596&name=Copa do Nordeste">Copa do Nordeste</a></li>
                    </ul>
                </div>
                <div class="mega-col">
                    <h4>Campeonatos Estaduais</h4>
                    <ul>
                        <li><a href="${prefix}pages/campeonato.html?id=372&name=Campeonato Paulista">Campeonato Paulista</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=92&name=Campeonato Carioca">Campeonato Carioca</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=379&name=Campeonato Mineiro">Campeonato Mineiro</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=377&name=Campeonato Gaúcho">Campeonato Gaúcho</a></li>
                    </ul>
                </div>
            </div>
        </li>
        <li class="nav-item has-dropdown">
            <a href="#" class="nav-link">Sul-Americano <i class="fas fa-chevron-down"></i></a>
            <div class="dropdown-menu">
                <ul>
                    <li><a href="${prefix}pages/campeonato.html?id=384&name=Copa Libertadores">Copa Libertadores</a></li>
                    <li><a href="${prefix}pages/campeonato.html?id=480&name=Copa Sudamericana">Copa Sudamericana</a></li>
                </ul>
            </div>
        </li>
        <li class="nav-item has-dropdown">
            <a href="#" class="nav-link">Europa <i class="fas fa-chevron-down"></i></a>
            <div class="dropdown-menu mega-menu">
                <div class="mega-col">
                    <h4>Competições UEFA</h4>
                    <ul>
                        <li><a href="${prefix}pages/campeonato.html?id=7&name=Champions League">Champions League</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=679&name=Europa League">Europa League</a></li>
                    </ul>
                </div>
                <div class="mega-col">
                    <h4>Ligas Nacionais</h4>
                    <ul>
                        <li><a href="${prefix}pages/campeonato.html?id=17&name=Premier League">Premier League</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=8&name=La Liga">La Liga</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=23&name=Serie A Itália">Serie A (Itália)</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=35&name=Bundesliga">Bundesliga</a></li>
                        <li><a href="${prefix}pages/campeonato.html?id=34&name=Ligue 1">Ligue 1</a></li>
                    </ul>
                </div>
            </div>
        </li>
        <li class="nav-item has-dropdown">
            <a href="#" class="nav-link">Esportes <i class="fas fa-chevron-down"></i></a>
            <div class="dropdown-menu mega-menu">
                <div class="mega-col">
                    <h4>Populares</h4>
                    <ul>
                        <li><a href="${prefix}pages/esporte.html?s=nba">NBA / Basquete</a></li>
                        <li><a href="${prefix}pages/esporte.html?s=tenis">Tênis</a></li>
                        <li><a href="${prefix}pages/esporte.html?s=f1">Fórmula 1</a></li>
                        <li><a href="${prefix}pages/esporte.html?s=mma">MMA / UFC</a></li>
                    </ul>
                </div>
                <div class="mega-col">
                    <h4>Mais Esportes</h4>
                    <ul>
                        <li><a href="${prefix}pages/esporte.html?s=volei">Vôlei</a></li>
                        <li><a href="${prefix}pages/esporte.html?s=esports">eSports</a></li>
                        <li><a href="${prefix}pages/esporte.html?s=nfl">NFL</a></li>
                    </ul>
                </div>
            </div>
        </li>
        <li class="nav-item">
            <a href="${prefix}pages/noticias.html" class="nav-link">Notícias</a>
        </li>
        <li class="nav-item">
            <a href="${prefix}pages/agenda.html" class="nav-link">Agenda</a>
        </li>
        <li class="nav-item">
            <a href="${prefix}pages/ao-vivo.html" class="nav-link live-link"><span class="live-dot"></span> AO VIVO</a>
        </li>
    `;

    // Find nav-list and inject
    const navList = document.querySelector('.nav-list');
    if (navList) {
        navList.innerHTML = navHTML;

        // Highlight active page
        const path = window.location.pathname;
        navList.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href && path.includes(href.replace('../', '').replace('index.html', ''))) {
                link.closest('.nav-item')?.classList.add('active');
            }
        });

        // Mobile dropdown toggle
        if (window.innerWidth <= 768) {
            navList.querySelectorAll('.nav-item.has-dropdown > .nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    link.parentElement.classList.toggle('dropdown-open');
                });
            });
        }
    }

    // === INJECT SIDE PANEL (if not already on page) ===
    if (!document.getElementById('teamsPanel')) {
        const panelOverlay = document.createElement('div');
        panelOverlay.className = 'teams-panel-overlay';
        panelOverlay.id = 'teamsPanelOverlay';
        panelOverlay.onclick = function() { toggleTeamsPanel(); };
        document.body.appendChild(panelOverlay);

        const panel = document.createElement('div');
        panel.className = 'teams-panel';
        panel.id = 'teamsPanel';
        panel.innerHTML = `
            <div class="teams-panel-header">
                <h3>Menu</h3>
                <button class="teams-panel-close" onclick="toggleTeamsPanel()"><i class="fas fa-times"></i></button>
            </div>
            <div class="teams-section">
                <div class="teams-section-list" style="display:block">
                    <a href="${prefix}index.html" class="teams-item" style="font-weight:600">Início</a>
                    <a href="${prefix}pages/noticias.html" class="teams-item" style="font-weight:600">Notícias</a>
                    <a href="${prefix}pages/ao-vivo.html" class="teams-item" style="font-weight:600;color:#E8312A">Ao Vivo</a>
                    <a href="${prefix}pages/agenda.html" class="teams-item" style="font-weight:600">Agenda</a>
                    <a href="${prefix}pages/campeonato.html?id=325&name=Brasileirão Série A" class="teams-item" style="font-weight:600">Brasileirão</a>
                    <a href="${prefix}pages/campeonato.html?id=7&name=Champions League" class="teams-item" style="font-weight:600">Champions League</a>
                    <a href="${prefix}pages/campeonato.html?id=384&name=Copa Libertadores" class="teams-item" style="font-weight:600">Libertadores</a>
                    <a href="${prefix}pages/noticias.html?cat=Copa%20do%20Mundo" class="teams-item" style="font-weight:600">Copa do Mundo 2026</a>
                    <a href="${prefix}pages/noticias.html?cat=Seleção%20Brasileira" class="teams-item" style="font-weight:600">Seleção Brasileira</a>
                </div>
            </div>
            <div class="teams-section" style="border-top:2px solid #E2E5E9">
                <div style="padding:12px 20px;font-size:13px;font-weight:700;color:#1A1D23;background:#F2F3F5">Esportes</div>
            </div>
            <div class="teams-section">
                <div class="teams-section-list" style="display:block">
                    <a href="${prefix}pages/esporte.html?s=nba" class="teams-item">NBA / Basquete</a>
                    <a href="${prefix}pages/esporte.html?s=tenis" class="teams-item">Tênis</a>
                    <a href="${prefix}pages/esporte.html?s=f1" class="teams-item">Fórmula 1</a>
                    <a href="${prefix}pages/esporte.html?s=mma" class="teams-item">MMA / UFC</a>
                    <a href="${prefix}pages/esporte.html?s=volei" class="teams-item">Vôlei</a>
                    <a href="${prefix}pages/esporte.html?s=esports" class="teams-item">eSports</a>
                    <a href="${prefix}pages/esporte.html?s=nfl" class="teams-item">NFL</a>
                    <a href="${prefix}pages/noticias.html?cat=MLB" class="teams-item">MLB / Beisebol</a>
                    <a href="${prefix}pages/noticias.html?cat=NHL" class="teams-item">NHL / Hóquei</a>
                    <a href="${prefix}pages/noticias.html?cat=Futsal" class="teams-item">Futsal</a>
                    <a href="${prefix}pages/noticias.html?cat=Handebol" class="teams-item">Handebol</a>
                </div>
            </div>
            <div class="teams-section" style="border-top:2px solid #E2E5E9">
                <div style="padding:12px 20px;font-size:13px;font-weight:700;color:#1A1D23;background:#F2F3F5">Meu Time</div>
            </div>
            <div class="teams-search">
                <input type="text" placeholder="Buscar time..." oninput="filterTeams(this.value)">
            </div>
            <div class="teams-section">
                <div class="teams-section-title" onclick="this.classList.toggle('collapsed')">Brasileirão Série A <i class="fas fa-chevron-down"></i></div>
                <div class="teams-section-list">
                    <a href="${prefix}pages/time.html?slug=palmeiras" class="teams-item"><img src="/img/team/1963/image" alt="" onerror="this.remove()">Palmeiras</a>
                    <a href="${prefix}pages/time.html?slug=flamengo" class="teams-item"><img src="/img/team/5981/image" alt="" onerror="this.remove()">Flamengo</a>
                    <a href="${prefix}pages/time.html?slug=corinthians" class="teams-item"><img src="/img/team/1957/image" alt="" onerror="this.remove()">Corinthians</a>
                    <a href="${prefix}pages/time.html?slug=sao-paulo" class="teams-item"><img src="/img/team/1981/image" alt="" onerror="this.remove()">São Paulo</a>
                    <a href="${prefix}pages/time.html?slug=fluminense" class="teams-item"><img src="/img/team/1961/image" alt="" onerror="this.remove()">Fluminense</a>
                    <a href="${prefix}pages/time.html?slug=botafogo" class="teams-item"><img src="/img/team/1958/image" alt="" onerror="this.remove()">Botafogo</a>
                    <a href="${prefix}pages/time.html?slug=santos" class="teams-item"><img src="/img/team/1968/image" alt="" onerror="this.remove()">Santos</a>
                    <a href="${prefix}pages/time.html?slug=vasco" class="teams-item"><img src="/img/team/1974/image" alt="" onerror="this.remove()">Vasco</a>
                    <a href="${prefix}pages/time.html?slug=gremio" class="teams-item"><img src="/img/team/5926/image" alt="" onerror="this.remove()">Grêmio</a>
                    <a href="${prefix}pages/time.html?slug=internacional" class="teams-item"><img src="/img/team/1966/image" alt="" onerror="this.remove()">Internacional</a>
                    <a href="${prefix}pages/time.html?slug=atletico-mg" class="teams-item"><img src="/img/team/1977/image" alt="" onerror="this.remove()">Atlético-MG</a>
                    <a href="${prefix}pages/time.html?slug=cruzeiro" class="teams-item"><img src="/img/team/1954/image" alt="" onerror="this.remove()">Cruzeiro</a>
                    <a href="${prefix}pages/time.html?slug=bahia" class="teams-item"><img src="/img/team/1955/image" alt="" onerror="this.remove()">Bahia</a>
                    <a href="${prefix}pages/time.html?slug=fortaleza" class="teams-item"><img src="/img/team/2020/image" alt="" onerror="this.remove()">Fortaleza</a>
                    <a href="${prefix}pages/time.html?slug=athletico-pr" class="teams-item"><img src="/img/team/1967/image" alt="" onerror="this.remove()">Athletico-PR</a>
                </div>
            </div>
            <div class="teams-section">
                <div class="teams-section-title collapsed" onclick="this.classList.toggle('collapsed')">Europa <i class="fas fa-chevron-down"></i></div>
                <div class="teams-section-list" style="display:none">
                    <a href="${prefix}pages/time.html?slug=real-madrid" class="teams-item"><img src="/img/team/2829/image" alt="" onerror="this.remove()">Real Madrid</a>
                    <a href="${prefix}pages/time.html?slug=barcelona" class="teams-item"><img src="/img/team/2817/image" alt="" onerror="this.remove()">Barcelona</a>
                    <a href="${prefix}pages/time.html?slug=liverpool" class="teams-item"><img src="/img/team/44/image" alt="" onerror="this.remove()">Liverpool</a>
                    <a href="${prefix}pages/time.html?slug=manchester-city" class="teams-item"><img src="/img/team/17/image" alt="" onerror="this.remove()">Manchester City</a>
                    <a href="${prefix}pages/time.html?slug=arsenal" class="teams-item"><img src="/img/team/42/image" alt="" onerror="this.remove()">Arsenal</a>
                    <a href="${prefix}pages/time.html?slug=juventus" class="teams-item"><img src="/img/team/2687/image" alt="" onerror="this.remove()">Juventus</a>
                    <a href="${prefix}pages/time.html?slug=psg" class="teams-item"><img src="/img/team/1644/image" alt="" onerror="this.remove()">PSG</a>
                    <a href="${prefix}pages/time.html?slug=bayern" class="teams-item"><img src="/img/team/2672/image" alt="" onerror="this.remove()">Bayern</a>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // Global functions for side panel
    window.toggleTeamsPanel = function() {
        document.getElementById('teamsPanel').classList.toggle('active');
        document.getElementById('teamsPanelOverlay').classList.toggle('active');
        document.body.style.overflow = document.getElementById('teamsPanel').classList.contains('active') ? 'hidden' : '';
    };

    window.filterTeams = function(q) {
        const lower = q.toLowerCase();
        document.querySelectorAll('.teams-item').forEach(item => {
            if (item.closest('.teams-panel-header') || item.closest('.teams-section-list:first-child')) return;
            item.style.display = item.textContent.toLowerCase().includes(lower) ? 'flex' : 'none';
        });
        if (q) document.querySelectorAll('.teams-section-title').forEach(t => t.classList.remove('collapsed'));
    };

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && document.getElementById('teamsPanel')?.classList.contains('active')) toggleTeamsPanel();
    });
})();
