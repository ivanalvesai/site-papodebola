# Papo de Bola - Documentação Completa

Portal de futebol brasileiro e mundial com notícias geradas por IA, placares ao vivo, classificações e transmissões.

**URL**: https://papodebola.com.br
**WordPress Admin**: https://admin.papodebola.com.br/wp-admin
**GitHub**: https://github.com/ivanalvesai/site-papodebola

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Front-end** | HTML/CSS/JS puro (site estático) |
| **CMS** | WordPress 6 (headless, Docker) |
| **SEO** | Rank Math Premium |
| **API de dados** | AllSportsApi (Sofascore) via RapidAPI - Pro $19.99/mês |
| **Geração de artigos** | Claude Sonnet (Anthropic API) |
| **Imagens** | Thumbnails YouTube (AllSportsApi team media) + Pexels (fallback) |
| **Humanização** | Skill Humanizer integrada no prompt |
| **Servidor** | Debian Linux, Docker |
| **CDN/SSL** | Cloudflare (Full mode) |
| **Cache** | Scripts Node.js via cron |

---

## Servidor

| | |
|---|---|
| **IP** | 138.117.60.14 |
| **Porta SSH** | 1822 |
| **Usuário** | ivan |
| **SSH Key** | ~/.ssh/debian_ed25519 |
| **Comando SSH** | `ssh -i ~/.ssh/debian_ed25519 -p 1822 ivan@138.117.60.14` |

### Diretórios
- **Site front-end**: `/home/ivan/site-papodebola`
- **WordPress**: `/home/ivan/wordpress-papodebola` (docker-compose)
- **Nginx config**: `/opt/signsimples/nginx/nginx.conf`
- **SSL papodebola**: `/opt/signsimples/nginx/ssl-papodebola/`
- **SSL admin**: `/opt/signsimples/nginx/ssl-admin-papodebola/`

### Serviços
| Serviço | Tipo | Porta |
|---|---|---|
| **Nginx** | Docker `signsimples-nginx-1` | 80, 443, 8090 |
| **WordPress** | Docker `wordpress-papodebola-wordpress-1` | 8091 |
| **MariaDB** | Docker `wordpress-papodebola-db-1` | 3306 |
| **Micro API** | systemd `papodebola-api` | 5055 |

### Nginx Routing
| Domínio | Destino |
|---|---|
| `papodebola.com.br` | Static files `/var/www/papodebola` (porta 443 SSL) |
| `admin.papodebola.com.br` | WordPress Docker (porta 8091) |
| `/pdb-api/*` | Micro API Node.js (porta 5055) |
| `/img/player/*` | Proxy Sofascore (com referer header) |
| `/img/team/*` | Proxy Sofascore (com referer header) |
| `:8090` | Acesso direto por IP |

### Deploy
```bash
# Opção 1: Script
bash deploy.sh

# Opção 2: Manual
git push origin main
ssh -i ~/.ssh/debian_ed25519 -p 1822 ivan@138.117.60.14 "cd /home/ivan/site-papodebola && git pull && sudo systemctl restart papodebola-api"

# Nginx: recriar container (reload simples NÃO funciona para config via volume)
cd /opt/signsimples && sudo docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

### Cache-busting
Ao alterar CSS ou JS, incrementar `?v=N` em TODOS os HTMLs. Atual: `v=22`.
Após deploy visual: **Purge Everything** no Cloudflare.
**IMPORTANTE**: Manter TODAS as páginas na mesma versão de CSS/JS. Versões desincronizadas causam bugs (ex: side panel invisível).

---

## Estrutura de Arquivos

```
site-papodebola/
├── index.html                      # Homepage (notícias, destaques, mercado da bola)
├── favicon.svg                     # Ícone (bola verde SVG)
├── manifest.json                   # PWA manifest
├── robots.txt                      # SEO robots
├── 404.html                        # Página de erro personalizada
├── css/style.css                   # Todos os estilos (tema light, Open Sans)
├── js/
│   ├── config.js                   # API keys, tournament IDs, categories
│   ├── api.js                      # Lê cache JSON ou chama API direta
│   ├── admin.js                    # Painel admin (auth via API, editor, usuários)
│   ├── nav.js                      # Navegação compartilhada + side panel (todas as páginas)
│   └── app.js                      # Renderiza homepage, ao vivo, sidebar
├── pages/
│   ├── ao-vivo.html                # Jogos ao vivo com placares
│   ├── noticias.html               # Listagem de artigos com filtros e paginação
│   ├── campeonato.html             # Classificação + jogos por rodada (lado a lado)
│   ├── time.html                   # Página dedicada por time
│   ├── sobre.html                  # Institucional
│   ├── contato.html                # Contato
│   └── privacidade.html            # LGPD
├── artigos/                        # Artigos HTML estáticos (gerados do WordPress)
│   └── img/                        # Imagens dos artigos (thumbnails reais)
├── cache/                          # JSON cache + scripts de geração
│   ├── update.sh                   # Orquestrador do cron (roda a cada 30 min)
│   ├── build-articles.js           # RSS → Claude → WordPress → static HTML
│   ├── build-home.js               # Highlights, transferências, RSS para homepage
│   ├── build-scorers.js            # Artilheiros top 10 times Brasileirão
│   ├── build-championship.js       # Rodadas e classificações dos campeonatos
│   ├── build-sports.js             # Cache de esportes (NBA, Tênis, F1, MMA, etc.)
│   ├── build-cbf.js                # Calendário futebol brasileiro via API CBF (gratuita)
│   ├── build-apifootball.js        # API-Football (DESATIVADO - plano grátis só 2022-2024)
│   ├── sync-wordpress.js           # Sincroniza WP posts para front-end
│   ├── rebuild-html.js             # Regenera HTMLs do articles.json
│   ├── migrate-to-wp.js            # Migração de artigos para WordPress
│   ├── configure-rankmath.php      # Configuração do Rank Math
│   ├── optimize-seo-v*.php         # Scripts de otimização SEO
│   ├── fix-images.php              # Corrige posts sem featured image
│   ├── live.json                   # Jogos ao vivo (DESATIVADO)
│   ├── today.json / tomorrow.json  # Jogos do dia (AllSportsApi)
│   ├── standings_brasileirao.json  # Classificação Brasileirão (AllSportsApi)
│   ├── scorers_brasileirao.json    # Artilheiros (AllSportsApi)
│   ├── home.json                   # Dados da homepage (AllSportsApi)
│   ├── articles.json               # Banco de artigos (sync do WP)
│   ├── champ_*.json                # Cache por campeonato (AllSportsApi)
│   ├── sport_*.json                # Cache por esporte (AllSportsApi)
│   ├── athletes.json               # Cache de atletas (AllSportsApi)
│   ├── agenda_*.json               # Cache de agenda por data (AllSportsApi)
│   ├── cbf_calendario.json         # Calendário futebol brasileiro (CBF API gratuita)
│   ├── cbf_hoje.json               # Jogos brasileiros de hoje (CBF API gratuita)
│   └── meta.json                   # Timestamp última atualização
├── api/
│   ├── server.js                   # Micro API Node.js (CRUD artigos, auth)
│   ├── article-template.js         # Template HTML compartilhado dos artigos
│   └── users.json                  # Banco de usuários
└── .claude/skills/                 # Skills do Claude Code
    ├── frontend-design/            # Design profissional
    ├── ui-ux-pro-max/              # Guidelines UI/UX
    └── humanizer/                  # Remove padrões de IA na escrita
```

---

## APIs Externas

### AllSportsApi (Sofascore) - RapidAPI Pro — FALLBACK
- **Host**: `allsportsapi2.p.rapidapi.com`
- **Key**: `cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2`
- **Plano**: Pro ($19.99/mês, 10.000 req/mês)
- **Uso atual**: Esportes (NBA, Tênis, F1, MMA) + futebol (standings, placares, rodadas) + homepage
- **Consumo**: ~130 req/dia (~3.900/mês, 39% do plano)

#### Endpoints usados:
| Endpoint | Uso |
|---|---|
| `matches/live` | Jogos ao vivo |
| `matches/{d}/{m}/{y}` | Jogos por data |
| `matches/top/{d}/{m}/{y}` | Jogos em destaque |
| `tournament/{id}/season/{sid}/standings/total` | Classificação |
| `tournament/{id}/season/{sid}/rounds` | Rodadas |
| `tournament/{id}/season/{sid}/matches/round/{r}` | Jogos por rodada |
| `team/{id}/media` | Thumbnails de partidas (YouTube) |
| `team/{id}/transfers` | Transferências |
| `team/{id}/tournament/{tid}/season/{sid}/best-players` | Artilheiros |
| `search/{term}` | Busca de times/torneios |

#### IDs dos Campeonatos (Season 2026):
| Campeonato | ID | Season |
|---|---|---|
| Brasileirão Série A | 325 | 87678 |
| Brasileirão Série B | 390 | 89840 |
| Copa do Brasil | 373 | 89353 |
| Copa do Nordeste | 1596 | 91324 |
| Paulista | 372 | 86993 |
| Carioca | 92 | 86674 |
| Mineiro | 379 | 87236 |
| Gaúcho | 377 | 86736 |
| Paranaense | 382 | 86658 |
| Pernambucano | 380 | 87395 |
| Libertadores | 384 | 87760 |
| Sudamericana | 480 | 87770 |
| Champions League | 7 | 76953 |
| Europa League | 679 | 76984 |
| Premier League | 17 | 76986 |
| La Liga | 8 | 77559 |
| Serie A (Itália) | 23 | 76457 |
| Bundesliga | 35 | 77333 |
| Ligue 1 | 34 | 77356 |

#### IDs dos Times (verificados via API standings):
| Time | ID | | Time | ID |
|---|---|---|---|---|
| Palmeiras | 1963 | | Liverpool | 44 |
| Flamengo | 5981 | | Arsenal | 42 |
| Corinthians | 1957 | | Man City | 17 |
| São Paulo | 1981 | | Man United | 35 |
| Santos | 1968 | | Chelsea | 38 |
| Fluminense | 1961 | | Tottenham | 33 |
| Botafogo | 1958 | | Real Madrid | 2829 |
| Vasco | 1974 | | Barcelona | 2817 |
| Grêmio | 5926 | | Juventus | 2687 |
| Internacional | 1966 | | Milan | 2692 |
| Atlético-MG | 1977 | | Inter Milan | 2697 |
| Cruzeiro | 1954 | | Bayern | 2672 |
| Bahia | 1955 | | PSG | 1644 |
| Fortaleza | 2020 | | Porto | 3002 |
| Athletico | 1967 | | Nott. Forest | 174 |
| Bragantino | 1999 | | Aston Villa | 40 |
| Coritiba | 1982 | | Dortmund | 2673 |

### CBF API (Gratuita) — Calendário do futebol brasileiro
- **Base URL**: `https://gweb.cbf.com.br/api/site/v1`
- **Auth**: `Authorization: Bearer Cbf@2022!` (token público do JS do site cbf.com.br)
- **Custo**: Gratuito, sem limite documentado
- **Uso**: Calendário (datas, horários, estádios, confrontos)
- **NÃO usar para**: Placares e standings (dados de mandante/visitante invertidos)
- **Consumo**: 6 req/dia (2x/dia, 3 campeonatos)
- **Script**: `cache/build-cbf.js`

#### Endpoints confirmados:
| Endpoint | Retorno |
|---|---|
| `/campeonatos` | Lista todos os campeonatos |
| `/campeonatos/anos` | Campeonatos por ano com IDs e categorias |
| `/jogos/campeonato/{id}` | TODOS os jogos (1 req = tudo, com datas/horários/estádios) |

#### IDs CBF 2026:
| Campeonato | CBF ID |
|---|---|
| Brasileirão Série A | 1260611 |
| Brasileirão Série B | 1260612 |
| Copa do Brasil | 1260615 |
| Supercopa | 1260616 |
| Copa do Nordeste | 1260624 |

#### Arquivos gerados:
| Arquivo | Conteúdo |
|---|---|
| `cbf_calendario.json` | Todos os jogos brasileiros (datas, horários, estádios, rodadas) |
| `cbf_hoje.json` | Jogos brasileiros de hoje |

**AVISO**: O token `Cbf@2022!` é público (extraído do JS do site cbf.com.br) e pode mudar sem aviso.

### API-Football (DESATIVADA)
- **Base URL**: `https://v3.football.api-sports.io`
- **Key**: `767b3820c4470e045a70cf44ef4a6da7`
- **Plano**: Grátis (100 req/dia)
- **Status**: DESATIVADA — plano grátis só dá acesso a temporadas 2022-2024, não 2025-2026
- **Script**: `cache/build-apifootball.js` (pronto, mas não é usado)
- **Para reativar**: Assinar plano pago e descomentar no update.sh

### Anthropic (Claude API)
- **Uso**: Reescrita de artigos (2000+ palavras, humanizado)
- **Modelo**: claude-sonnet-4-6
- **Key**: Compartilhada com projeto automacao-site (`/home/ivan/automacao-site/.env`)
- **Prompt**: Inclui tradução obrigatória para PT-BR, regras de humanização, subtítulos em MAIÚSCULAS

### Pexels API
- **Uso**: Fallback de imagens (estádios, fotos de futebol)
- **Key**: Compartilhada com automacao-site

### WordPress REST API
- **Base**: `https://admin.papodebola.com.br/wp-json/wp/v2`
- **Auth**: Application Passwords (Basic Auth)
- **User**: `ivanalves`
- **App Password**: `HeYF 49xY pg73 dhQi 5zZq 4B6K`

---

## Sistema de Artigos

### Fluxo automático (cron 2x/dia, 8h e 15h):
```
RSS (7 feeds) → Claude Sonnet (reescreve 2000+ palavras em PT-BR)
  → Busca imagem (AllSportsApi team media > Pexels team+stadium > Pexels keywords > Pexels aerial)
  → Publica no WordPress (com SEO completo Rank Math)
  → Upload featured image no WordPress
  → Adiciona internal links ("Leia também")
  → Sync para front-end estático
```

### RSS Feeds (7 ativos):
| Feed | Volume | Foco |
|---|---|---|
| torcedores.com/feed | 20/dia | BR geral |
| terra.com.br/esportes/futebol/rss.xml | 10/dia | BR geral |
| trivela.com.br/feed/ | 2/dia | Análises BR+Europa |
| futebolatino.com.br/feed/ | 2/dia | Libertadores |
| feeds.bbci.co.uk/sport/football/rss.xml | 28/dia | Internacional EN |
| theguardian.com/football/rss | 16/dia | Internacional EN |
| meutimao.com.br/feed | 16/dia | Corinthians |

### Limites de geração:
- **Max 1 artigo por execução** (1 por slot)
- **10 slots/dia** em horários de pico: 7:00, 8:30, 10:00, 11:30, 13:00, 14:30, 16:00, 18:00, 20:00, 21:30
- **~10 artigos/dia** (5 futebol + 5 esportes variados, rotação)

### SEO aplicado em cada post (Rank Math 75+):
- Focus keyword (3 palavras do título, sem stop words)
- Secondary keywords (tags de times)
- SEO title < 60 chars com `| Papo de Bola`
- Meta description com keyword + CTA "Leia mais!"
- Slug < 55 chars
- H2 headings de subtítulos em MAIÚSCULAS
- Table of Contents (quando 3+ headings)
- KW density ~1% (inserção natural a cada 4 parágrafos)
- KW no primeiro parágrafo
- External link dofollow (CBF/UEFA/FIFA por categoria)
- Internal links "Leia também" (3 posts relacionados com URL pública)
- Schema NewsArticle
- Open Graph + Twitter Cards
- Featured image com alt text
- Excerpt preenchido

### Prompt de humanização (skill Humanizer):
- Palavras proibidas de IA: crucial, pivotal, landscape, tapestry, testament, etc.
- Variação de ritmo (frases curtas + longas)
- Opinião pessoal, primeira pessoa
- Tom de conversa entre amigos que entendem de futebol
- Detalhes sensoriais
- Tradução obrigatória para PT-BR (artigos em EN/ES)

---

## WordPress

### Acesso:
- **URL**: `https://admin.papodebola.com.br/wp-admin`
- **User**: `ivanalves`
- **Docker**: `wordpress-papodebola-wordpress-1` (porta 8091)
- **DB**: MariaDB 10.11 (`wordpress-papodebola-db-1`)

### Plugins:
- **Rank Math Premium** (SEO)
- **Classic Editor**
- **Table of Contents Plus**

### Categorias criadas:
Brasileirão, Copa do Brasil, Copa do Mundo, Seleção Brasileira, Copa Libertadores, Champions League, Premier League, La Liga, Futebol Internacional, Mercado da Bola, Copa Sudamericana, Eliminatórias, Futebol Brasileiro

### Tags de times:
Palmeiras, Flamengo, Corinthians, São Paulo, Santos, Fluminense, Botafogo, Vasco, Grêmio, Internacional, Atlético-MG, Cruzeiro, Bahia, Fortaleza, Athletico-PR, Real Madrid, Barcelona, Liverpool

### Rank Math configurado:
- Breadcrumbs on
- Schema NewsArticle padrão
- Open Graph + Twitter Cards
- Nofollow em links externos
- Strip category base
- Image SEO (alt/title automáticos)
- Sitemap: posts, pages, categories, tags
- Ping automático Google/Bing

---

## Cron (a cada 30 minutos)

```
*/30 * * * * /bin/bash /home/ivan/site-papodebola/cache/update.sh
```

### Tabela do Cron

| Tarefa | API | Frequência | Horários | Req/exec |
|---|---|---|---|---|
| Jogos de hoje + amanhã | AllSportsApi | 1x/dia | 08h | 2 |
| Standings Brasileirão | AllSportsApi | Ter/Qua 2x + Sáb/Dom 6x | Dias de jogo | 1 |
| Artilheiros (build-scorers) | AllSportsApi | 1x/dia | 08h | 10 |
| Homepage (build-home) | AllSportsApi | 1x/dia | 14h | 15 |
| Esportes (build-sports) | AllSportsApi | 1x/dia | 16h | ~45 |
| Campeonatos (build-championship) | AllSportsApi | 2x/dia | 08h, 22h | ~28 |
| **Calendário brasileiro (build-cbf)** | **CBF** | **2x/dia** | **08h, 20h** | **3** |
| Geração de artigos | Claude API | 10x/dia | 7h-21:30h | 0 (API Anthropic) |
| Sync WordPress → front-end | Local | 30 min | 24h | 0 |
| SEO posts novos | Local/WP | 30 min | 24h | 0 |
| ~~Ao Vivo (matches/live)~~ | ~~AllSportsApi~~ | **DESATIVADO** | — | — |
| ~~API-Football~~ | ~~API-Football~~ | **DESATIVADO** | — | — |

### Funcionalidades desativadas

**Ao Vivo**: O fetch de `matches/live` e o menu "AO VIVO" estão desativados para economizar quota.
Para reativar: descomentar `fetch "matches/live"` no update.sh, restaurar o link no nav.js,
e restaurar as tabs com placares no index.html.

**API-Football**: Plano grátis só dá acesso a temporadas 2022-2024.
Para reativar: assinar plano pago, configurar `APIFOOTBALL_KEY` no `.env`, descomentar no update.sh.
Script pronto em `cache/build-apifootball.js`.

### Cache de Esportes (build-sports.js)
Todas as páginas de esportes (esporte.html, atleta.html, agenda.html) lêem dados de arquivos JSON cacheados. **Nenhuma página faz chamadas diretas à API**.

| Arquivo | Fonte | Conteúdo |
|---|---|---|
| `sport_{slug}.json` | AllSportsApi | Live, today, calendar, standings/rankings do esporte |
| `athletes.json` | AllSportsApi | Info, resultados e próximos jogos dos 20 atletas |
| `agenda_{date}.json` | AllSportsApi | Jogos de futebol por data (agenda.html) |
| `cbf_calendario.json` | CBF API | Calendário brasileiro (datas, horários, estádios) |
| `cbf_hoje.json` | CBF API | Jogos brasileiros de hoje |

### Consumo estimado mensal

| API | Req/dia | Req/mês | Custo | % do plano |
|---|---|---|---|---|
| **CBF** | 6 | 180 | Grátis | — |
| **AllSportsApi** | ~130 | ~3.900 | $19.99 | 39% |
| **API-Football** | 0 | 0 | Grátis (desativada) | — |
| **TOTAL** | ~136 | ~4.080 | **$19.99** | — |

Sobram ~6.100 req/mês na AllSportsApi para reativar funcionalidades.

---

## Design

| | |
|---|---|
| **Tema** | Light (inspirado ge.globo.com) |
| **Cor primária** | Verde `#00965E` |
| **Cor live** | Vermelho `#E8312A` |
| **Fundo** | `#F2F3F5` |
| **Cards** | `#FFFFFF` com bordas `#E2E5E9` |
| **Fonte** | Open Sans 400 (todo o site) |
| **Favicon** | SVG bola verde |
| **Banner Copa** | Countdown até 11/06/2026, gradiente navy+dourado |

---

## Painel Admin (front-end)

- **Acesso**: Engrenagem no header ou `Ctrl+Shift+A`
- **Login**: Via API (`/pdb-api/login`)
- **Sessão**: 4 horas
- **Abas**: Jogos | Gerenciar | Artigos | Usuários | Config

### Endpoints da micro API:
| Endpoint | Método | Auth | Descrição |
|---|---|---|---|
| `/pdb-api/login` | POST | Não | Login |
| `/pdb-api/articles` | GET/POST | Sim | Listar/criar artigos |
| `/pdb-api/articles/{slug}` | PUT/DELETE | Sim | Editar/excluir |
| `/pdb-api/upload` | POST | Sim | Upload imagem (base64) |
| `/pdb-api/users` | GET/POST | Admin | Listar/criar usuários |
| `/pdb-api/users/{username}` | PUT/DELETE | Admin | Editar/excluir usuário |

---

## Proxy de Imagens (Nginx)

O Sofascore bloqueia requests sem referer. O nginx faz proxy com header correto:
- `/img/player/{id}/image` → `api.sofascore.app/api/v1/player/{id}/image`
- `/img/team/{id}/image` → `api.sofascore.app/api/v1/team/{id}/image`
- Cache: 7 dias no nginx

---

## Funcionalidades do Site

### Homepage
- Banner Copa do Mundo 2026 com countdown
- **Match bar com 2 abas**: "Hoje" (AllSportsApi, sem placar) + "Próximos" (CBF, jogos brasileiros)
- Destaques em vídeo (highlights YouTube)
- Últimas notícias (do WordPress) + botão "Mostrar Mais"
- Mercado da Bola (transferências)
- Sidebar: próximo jogo, classificação, artilheiros, resultados
- Cookie banner LGPD
- Fade-in animations on scroll
- ~~Ticker de jogos ao vivo~~ (DESATIVADO)
- ~~Ao Vivo com placares~~ (DESATIVADO)

### Página de campeonato
- Layout estilo ge.globo.com: classificação à esquerda, jogos à direita
- Navegação por rodada com setas
- Todas as rodadas cacheadas
- Artilharia abaixo da classificação
- Escudos dos times

### Página de notícias
- Listagem com paginação
- Filtros por categoria (Brasileirão, Copa do Mundo, Seleção, etc.)
- Busca por texto
- Card featured no topo

### Artigos
- Breadcrumbs
- Tempo de leitura
- Subtítulos em negrito (MAIÚSCULAS convertidas)
- Tags clicáveis (times e categorias)
- Botões de compartilhamento (WhatsApp, X, Facebook, Telegram, copiar link)
- Artigos relacionados (4 posts da mesma categoria)
- Schema NewsArticle

### Menu lateral (Side Panel)
- Injetado via `js/nav.js` em TODAS as páginas (index, pages/, artigos/)
- Funções globais: `toggleTeamsPanel()`, `filterTeams()`
- Ativado pelo botão "Menu" na nav bar (primeiro item)
- Seções: links rápidos, esportes, "Meu Time" com busca e escudos
- Times: Série A (12) + Europa (6), com escudos via Sofascore proxy
- Seções colapsáveis, busca em tempo real
- Fecha com Escape, clique no overlay, ou botão X
- **IMPORTANTE**: `nav.js` sempre substitui o conteúdo do `.nav-list` — não colocar itens fixos dentro do `<ul class="nav-list">` nos HTMLs

### Página de time
- Notícias filtradas por time
- Próximo jogo
- Posição na classificação
- Link para tabela completa

---

## Checklist para Novos Desenvolvedores

1. Clone: `git clone https://github.com/ivanalvesai/site-papodebola.git`
2. API keys estão em `js/config.js` (AllSportsApi) e `cache/build-articles.js` (WP + Anthropic)
3. Para rodar local, caches precisam existir em `/cache/*.json`
4. Cron e micro API só rodam no servidor
5. Ao alterar CSS/JS, incrementar `?v=N` em TODOS os HTMLs (atual: v=22) — manter sincronizado em TODAS as páginas
6. Após push, fazer pull no servidor e Purge no Cloudflare
7. WordPress é headless: front-end não usa temas WP, só API REST
8. Artigos são publicados no WP E como HTML estático (dupla publicação)
9. Imagens passam por proxy nginx (nunca usar api.sofascore.app direto)
10. Rank Math SEO deve ser mantido em novos posts (scripts PHP em cache/)
11. **nav.js sempre substitui `.nav-list`** — não colocar itens fixos no HTML
12. **3 APIs de dados**: AllSportsApi (paga, principal), CBF (grátis, calendário), API-Football (desativada)
13. **Nenhuma página faz chamada direta à API** — todas lêem de cache JSON

---

## Pendências / Próximos Passos

### Pronto para implementar:
- Google Analytics 4 (precisa do Measurement ID)
- Google Tag Manager (precisa do GTM ID)
- Google AdSense (precisa da conta aprovada)
- Microsoft Clarity (precisa do Project ID)
- Facebook Pixel (precisa do Pixel ID)
- Logo profissional (substituir ícone Font Awesome)

### Melhorias futuras:
- Migração para Next.js (SSR para SEO)
- Tailwind CSS
- Firebase Auth (login Google)
- Newsletter / captura de email
- Notificações push
- Dark mode toggle
- Comentários (Disqus ou similar)
