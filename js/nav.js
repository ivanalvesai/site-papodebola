/**
 * Shared navigation - injects the full menu into all pages
 * Include this script in any page to get the complete nav
 */
(function() {
    const isSubpage = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/artigos/');
    const prefix = isSubpage ? '../' : '';

    const navHTML = `
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
})();
