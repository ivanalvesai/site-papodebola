/**
 * Shared navigation + side panel for all pages
 */

// Detect if subpage
var _navPrefix = (window.location.pathname.includes('/pages/') || window.location.pathname.includes('/artigos/')) ? '../' : '';

// Side panel functions (global, available immediately)
function toggleTeamsPanel() {
    var panel = document.getElementById('teamsPanel');
    var overlay = document.getElementById('teamsPanelOverlay');
    if (panel && overlay) {
        panel.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = panel.classList.contains('active') ? 'hidden' : '';
    }
}

function filterTeams(q) {
    var lower = q.toLowerCase();
    var items = document.querySelectorAll('#teamsPanel .teams-item');
    for (var i = 0; i < items.length; i++) {
        items[i].style.display = items[i].textContent.toLowerCase().indexOf(lower) > -1 ? 'flex' : 'none';
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        var panel = document.getElementById('teamsPanel');
        if (panel && panel.classList.contains('active')) toggleTeamsPanel();
    }
});

// Inject nav + panel when DOM ready
document.addEventListener('DOMContentLoaded', function() {
    var p = _navPrefix;

    // Inject nav items
    var navList = document.querySelector('.nav-list');
    if (navList) {
        navList.innerHTML = '<li class="nav-item"><a href="#" class="nav-link" id="navMenuBtn"><i class="fas fa-bars" style="margin-right:3px"></i> Menu</a></li>'
            + '<li class="nav-item"><a href="' + p + 'index.html" class="nav-link">Início</a></li>'
            + '<li class="nav-item has-dropdown"><a href="#" class="nav-link">Brasil <i class="fas fa-chevron-down"></i></a><div class="dropdown-menu mega-menu"><div class="mega-col"><h4>Nacionais</h4><ul>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=325&name=Brasileirão Série A">Brasileirão Série A</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=390&name=Brasileirão Série B">Brasileirão Série B</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=373&name=Copa do Brasil">Copa do Brasil</a></li>'
            + '</ul></div><div class="mega-col"><h4>Estaduais</h4><ul>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=372&name=Campeonato Paulista">Paulista</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=92&name=Campeonato Carioca">Carioca</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=379&name=Campeonato Mineiro">Mineiro</a></li>'
            + '</ul></div></div></li>'
            + '<li class="nav-item has-dropdown"><a href="#" class="nav-link">Sul-Americano <i class="fas fa-chevron-down"></i></a><div class="dropdown-menu"><ul>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=384&name=Copa Libertadores">Libertadores</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=480&name=Copa Sudamericana">Sudamericana</a></li>'
            + '</ul></div></li>'
            + '<li class="nav-item has-dropdown"><a href="#" class="nav-link">Europa <i class="fas fa-chevron-down"></i></a><div class="dropdown-menu mega-menu"><div class="mega-col"><h4>UEFA</h4><ul>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=7&name=Champions League">Champions League</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=679&name=Europa League">Europa League</a></li>'
            + '</ul></div><div class="mega-col"><h4>Ligas</h4><ul>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=17&name=Premier League">Premier League</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=8&name=La Liga">La Liga</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=23&name=Serie A Itália">Serie A</a></li>'
            + '<li><a href="' + p + 'pages/campeonato.html?id=35&name=Bundesliga">Bundesliga</a></li>'
            + '</ul></div></div></li>'
            + '<li class="nav-item has-dropdown"><a href="#" class="nav-link">Esportes <i class="fas fa-chevron-down"></i></a><div class="dropdown-menu mega-menu"><div class="mega-col"><h4>Populares</h4><ul>'
            + '<li><a href="' + p + 'pages/esporte.html?s=nba">NBA</a></li>'
            + '<li><a href="' + p + 'pages/esporte.html?s=tenis">Tênis</a></li>'
            + '<li><a href="' + p + 'pages/esporte.html?s=f1">Fórmula 1</a></li>'
            + '<li><a href="' + p + 'pages/esporte.html?s=mma">MMA / UFC</a></li>'
            + '</ul></div><div class="mega-col"><h4>Mais</h4><ul>'
            + '<li><a href="' + p + 'pages/esporte.html?s=volei">Vôlei</a></li>'
            + '<li><a href="' + p + 'pages/esporte.html?s=esports">eSports</a></li>'
            + '<li><a href="' + p + 'pages/esporte.html?s=nfl">NFL</a></li>'
            + '</ul></div></div></li>'
            + '<li class="nav-item"><a href="' + p + 'pages/noticias.html" class="nav-link">Notícias</a></li>'
            + '<li class="nav-item"><a href="' + p + 'pages/agenda.html" class="nav-link">Agenda</a></li>'
            + '<li class="nav-item"><a href="' + p + 'pages/ao-vivo.html" class="nav-link live-link"><span class="live-dot"></span> AO VIVO</a></li>';

        // Menu button click
        var menuBtn = document.getElementById('navMenuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', function(e) {
                e.preventDefault();
                toggleTeamsPanel();
            });
        }

        // Mobile dropdowns
        if (window.innerWidth <= 768) {
            var dropdowns = navList.querySelectorAll('.nav-item.has-dropdown > .nav-link');
            for (var i = 0; i < dropdowns.length; i++) {
                dropdowns[i].addEventListener('click', function(e) {
                    e.preventDefault();
                    this.parentElement.classList.toggle('dropdown-open');
                });
            }
        }
    }

    // Inject side panel if not exists
    if (!document.getElementById('teamsPanel')) {
        var overlay = document.createElement('div');
        overlay.className = 'teams-panel-overlay';
        overlay.id = 'teamsPanelOverlay';
        overlay.addEventListener('click', toggleTeamsPanel);
        document.body.appendChild(overlay);

        var panel = document.createElement('div');
        panel.className = 'teams-panel';
        panel.id = 'teamsPanel';
        panel.innerHTML = '<div class="teams-panel-header"><h3>Menu</h3><button class="teams-panel-close" onclick="toggleTeamsPanel()"><i class="fas fa-times"></i></button></div>'
            + '<div class="teams-section"><div class="teams-section-list" style="display:block">'
            + '<a href="' + p + 'index.html" class="teams-item" style="font-weight:600">Início</a>'
            + '<a href="' + p + 'pages/noticias.html" class="teams-item" style="font-weight:600">Notícias</a>'
            + '<a href="' + p + 'pages/ao-vivo.html" class="teams-item" style="font-weight:600;color:#E8312A">Ao Vivo</a>'
            + '<a href="' + p + 'pages/agenda.html" class="teams-item" style="font-weight:600">Agenda</a>'
            + '<a href="' + p + 'pages/campeonato.html?id=325&name=Brasileirão Série A" class="teams-item" style="font-weight:600">Brasileirão</a>'
            + '<a href="' + p + 'pages/campeonato.html?id=7&name=Champions League" class="teams-item" style="font-weight:600">Champions League</a>'
            + '<a href="' + p + 'pages/campeonato.html?id=384&name=Copa Libertadores" class="teams-item" style="font-weight:600">Libertadores</a>'
            + '<a href="' + p + 'pages/noticias.html?cat=Copa%20do%20Mundo" class="teams-item" style="font-weight:600">Copa do Mundo 2026</a>'
            + '<a href="' + p + 'pages/noticias.html?cat=Seleção%20Brasileira" class="teams-item" style="font-weight:600">Seleção Brasileira</a>'
            + '</div></div>'
            + '<div class="teams-section" style="border-top:2px solid #E2E5E9"><div style="padding:12px 20px;font-size:13px;font-weight:700;color:#1A1D23;background:#F2F3F5">Esportes</div></div>'
            + '<div class="teams-section"><div class="teams-section-list" style="display:block">'
            + '<a href="' + p + 'pages/esporte.html?s=nba" class="teams-item">NBA / Basquete</a>'
            + '<a href="' + p + 'pages/esporte.html?s=tenis" class="teams-item">Tênis</a>'
            + '<a href="' + p + 'pages/esporte.html?s=f1" class="teams-item">Fórmula 1</a>'
            + '<a href="' + p + 'pages/esporte.html?s=mma" class="teams-item">MMA / UFC</a>'
            + '<a href="' + p + 'pages/esporte.html?s=volei" class="teams-item">Vôlei</a>'
            + '<a href="' + p + 'pages/esporte.html?s=esports" class="teams-item">eSports</a>'
            + '<a href="' + p + 'pages/esporte.html?s=nfl" class="teams-item">NFL</a>'
            + '</div></div>'
            + '<div class="teams-section" style="border-top:2px solid #E2E5E9"><div style="padding:12px 20px;font-size:13px;font-weight:700;color:#1A1D23;background:#F2F3F5">Meu Time</div></div>'
            + '<div class="teams-search"><input type="text" placeholder="Buscar time..." oninput="filterTeams(this.value)"></div>'
            + '<div class="teams-section"><div class="teams-section-title" onclick="this.classList.toggle(\'collapsed\')">Brasileirão Série A <i class="fas fa-chevron-down"></i></div>'
            + '<div class="teams-section-list">'
            + '<a href="' + p + 'pages/time.html?slug=palmeiras" class="teams-item"><img src="/img/team/1963/image" alt="" onerror="this.remove()">Palmeiras</a>'
            + '<a href="' + p + 'pages/time.html?slug=flamengo" class="teams-item"><img src="/img/team/5981/image" alt="" onerror="this.remove()">Flamengo</a>'
            + '<a href="' + p + 'pages/time.html?slug=corinthians" class="teams-item"><img src="/img/team/1957/image" alt="" onerror="this.remove()">Corinthians</a>'
            + '<a href="' + p + 'pages/time.html?slug=sao-paulo" class="teams-item"><img src="/img/team/1981/image" alt="" onerror="this.remove()">São Paulo</a>'
            + '<a href="' + p + 'pages/time.html?slug=santos" class="teams-item"><img src="/img/team/1968/image" alt="" onerror="this.remove()">Santos</a>'
            + '<a href="' + p + 'pages/time.html?slug=fluminense" class="teams-item"><img src="/img/team/1961/image" alt="" onerror="this.remove()">Fluminense</a>'
            + '<a href="' + p + 'pages/time.html?slug=botafogo" class="teams-item"><img src="/img/team/1958/image" alt="" onerror="this.remove()">Botafogo</a>'
            + '<a href="' + p + 'pages/time.html?slug=vasco" class="teams-item"><img src="/img/team/1974/image" alt="" onerror="this.remove()">Vasco</a>'
            + '<a href="' + p + 'pages/time.html?slug=gremio" class="teams-item"><img src="/img/team/5926/image" alt="" onerror="this.remove()">Grêmio</a>'
            + '<a href="' + p + 'pages/time.html?slug=internacional" class="teams-item"><img src="/img/team/1966/image" alt="" onerror="this.remove()">Internacional</a>'
            + '<a href="' + p + 'pages/time.html?slug=atletico-mg" class="teams-item"><img src="/img/team/1977/image" alt="" onerror="this.remove()">Atlético-MG</a>'
            + '<a href="' + p + 'pages/time.html?slug=cruzeiro" class="teams-item"><img src="/img/team/1954/image" alt="" onerror="this.remove()">Cruzeiro</a>'
            + '</div></div>'
            + '<div class="teams-section"><div class="teams-section-title collapsed" onclick="this.classList.toggle(\'collapsed\')">Europa <i class="fas fa-chevron-down"></i></div>'
            + '<div class="teams-section-list" style="display:none">'
            + '<a href="' + p + 'pages/time.html?slug=real-madrid" class="teams-item"><img src="/img/team/2829/image" alt="" onerror="this.remove()">Real Madrid</a>'
            + '<a href="' + p + 'pages/time.html?slug=barcelona" class="teams-item"><img src="/img/team/2817/image" alt="" onerror="this.remove()">Barcelona</a>'
            + '<a href="' + p + 'pages/time.html?slug=liverpool" class="teams-item"><img src="/img/team/44/image" alt="" onerror="this.remove()">Liverpool</a>'
            + '<a href="' + p + 'pages/time.html?slug=manchester-city" class="teams-item"><img src="/img/team/17/image" alt="" onerror="this.remove()">Manchester City</a>'
            + '<a href="' + p + 'pages/time.html?slug=juventus" class="teams-item"><img src="/img/team/2687/image" alt="" onerror="this.remove()">Juventus</a>'
            + '<a href="' + p + 'pages/time.html?slug=psg" class="teams-item"><img src="/img/team/1644/image" alt="" onerror="this.remove()">PSG</a>'
            + '</div></div>';

        document.body.appendChild(panel);
    }
});
