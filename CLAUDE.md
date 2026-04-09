# Papo de Bola - Documentação do Projeto

Portal de futebol brasileiro com placares ao vivo, notícias geradas por IA, classificações e transmissões.

## Stack Tecnológica

- **Frontend**: HTML/CSS/JS puro (sem framework)
- **API de artigos**: Node.js HTTP server (api/server.js, porta 5055)
- **Cache de dados**: Scripts Node.js executados via cron
- **Imagens**: Proxy nginx para Sofascore + thumbnails YouTube
- **Servidor**: Debian Linux, Docker (nginx compartilhado com outros projetos)
- **CDN/SSL**: Cloudflare (Full mode)

## Estrutura de Arquivos

```
site-papodebola/
├── index.html                  # Homepage (notícias, destaques, mercado da bola)
├── favicon.svg                 # Ícone do site (bola verde SVG)
├── css/
│   └── style.css               # Todos os estilos (tema light, Inter + Oswald)
├── js/
│   ├── config.js               # Configuração (API keys, tournament IDs, categories)
│   ├── api.js                  # Camada de API (lê cache JSON ou chama API direta)
│   ├── admin.js                # Painel admin (auth, editor de artigos, gestão de usuários)
│   └── app.js                  # App principal (renderiza homepage, ao vivo, sidebar)
├── pages/
│   ├── ao-vivo.html            # Jogos ao vivo com placares em tempo real
│   ├── noticias.html           # Listagem de todos os artigos com paginação
│   └── campeonato.html         # Página dinâmica por campeonato (classificação, jogos)
├── artigos/                    # Artigos HTML gerados automaticamente
│   ├── img/                    # Imagens dos artigos (thumbnails de partidas reais)
│   └── {slug}.html             # Cada artigo é um HTML estático
├── cache/                      # Dados em cache (JSON) atualizados por cron
│   ├── update.sh               # Script principal do cron (roda a cada 30 min)
│   ├── build-home.js           # Busca highlights, transferências, notícias RSS
│   ├── build-articles.js       # Busca RSS, reescreve com Claude, gera páginas
│   ├── build-scorers.js        # Consolida artilheiros dos top 10 times
│   ├── live.json               # Jogos ao vivo
│   ├── today.json              # Jogos do dia
│   ├── tomorrow.json           # Jogos de amanhã
│   ├── standings_brasileirao.json  # Classificação Brasileirão
│   ├── scorers_brasileirao.json    # Artilheiros consolidados
│   ├── home.json               # Dados da homepage (highlights, news, transfers)
│   ├── articles.json           # Banco de artigos (últimos 50)
│   └── meta.json               # Timestamp da última atualização
├── api/
│   ├── server.js               # Micro API Node.js (CRUD artigos, auth, upload)
│   └── users.json              # Banco de usuários (username, hash, role)
└── deploy.sh                   # Script de deploy (push + pull + reload)
```

## APIs Externas

### AllSportsApi (Sofascore) - RapidAPI
- **Plano**: Pro ($19.99/mês)
- **Host**: `allsportsapi2.p.rapidapi.com`
- **Uso**: Jogos ao vivo, placares, classificações, estatísticas, mídia dos times, transferências

#### Endpoints principais:
| Endpoint | Descrição |
|---|---|
| `GET /api/matches/live` | Todos os jogos ao vivo |
| `GET /api/matches/{d}/{m}/{y}` | Jogos por data |
| `GET /api/matches/top/{d}/{m}/{y}` | Jogos em destaque do dia |
| `GET /api/tournament/{id}/season/{sid}/standings/total` | Classificação |
| `GET /api/team/{id}/media` | Vídeos e thumbnails de partidas |
| `GET /api/team/{id}/transfers` | Transferências |
| `GET /api/team/{id}/tournament/{tid}/season/{sid}/best-players` | Artilheiros |

#### IDs dos Campeonatos:
| Campeonato | Tournament ID | Season ID (2026) |
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

#### IDs dos Times Brasileiros:
| Time | Team ID |
|---|---|
| Palmeiras | 1963 |
| Flamengo | 5981 |
| São Paulo | 1981 |
| Corinthians | 1957 |
| Fluminense | 1961 |
| Santos | 1968 |
| Botafogo | 1958 |
| Vasco | 1952 |
| Grêmio | 1954 |
| Internacional | 1959 |
| Atlético-MG | 1977 |
| Cruzeiro | 1982 |
| Bahia | 1955 |
| Fortaleza | 1962 |
| Athletico-PR | 1967 |

### Anthropic (Claude) API
- **Uso**: Reescrita de artigos com IA (2000+ palavras cada)
- **Modelo**: claude-sonnet-4-6 (para artigos longos e bem escritos)
- **Key**: Compartilhada com projeto automacao-site (/home/ivan/automacao-site/.env)

### Pexels API
- **Uso**: Fallback de imagens quando não há thumbnail de partida
- **Key**: Compartilhada com projeto automacao-site

### RSS Feeds (7 ativos)
- **Torcedores**: `https://www.torcedores.com/feed` (20/dia, BR geral)
- **Terra Esportes**: `https://www.terra.com.br/esportes/futebol/rss.xml` (10/dia, BR geral)
- **Trivela**: `https://trivela.com.br/feed/` (2/dia, análises BR+Europa)
- **Futebol Latino**: `https://futebolatino.com.br/feed/` (2/dia, Libertadores)
- **BBC Sport**: `https://feeds.bbci.co.uk/sport/football/rss.xml` (28/dia, internacional EN)
- **The Guardian**: `https://www.theguardian.com/football/rss` (16/dia, internacional EN)
- **Meu Timão**: `https://www.meutimao.com.br/feed` (16/dia, Corinthians)

### Fonte padrão
- **Open Sans 400** em todo o site (sem Oswald)
- Google Fonts: `family=Open+Sans:wght@400;500;600;700`

### Skill Humanizer
- Integrada no prompt de geração de artigos
- Remove padrões de escrita de IA (palavras proibidas, estruturas genéricas)
- Tom de conversa entre amigos que entendem de futebol

## Sistema de Cache (cron)

O script `cache/update.sh` roda via cron a cada 30 minutos:

```
*/30 * * * * /bin/bash /home/ivan/site-papodebola/cache/update.sh
```

### Ciclo de atualização:
| Dado | Frequência | Calls/ciclo |
|---|---|---|
| Jogos ao vivo | Cada 30 min | 1 |
| Jogos de hoje | Cada 30 min | 1 |
| Jogos de amanhã | Cada 30 min | 1 |
| Classificação Brasileirão | Cada 30 min | 1 |
| Artilheiros (top 10 times) | Cada 6 horas | 10 |
| Homepage (highlights, transfers) | Cada 3 horas | ~15 |
| Artigos (RSS + reescrita IA) | Cada 3 horas | ~6 + Claude |

## Sistema de Artigos

### Geração automática (build-articles.js):
1. Busca RSS dos portais (Gazeta Esportiva, Torcedores)
2. Filtra artigos novos (não processados antes)
3. Reescreve com Claude Sonnet (2000+ palavras, formato jornalístico)
4. Busca imagem real de partida via AllSportsApi team media (thumbnails YouTube)
5. Fallback para Pexels se não encontrar thumbnail
6. Gera página HTML estática em `/artigos/{slug}.html`
7. Atualiza `home.json` com links locais
8. Máximo 3 artigos por feed por ciclo (controle de custo)

### Padrão dos artigos:
- **Tamanho**: Mínimo 2000 palavras
- **Estrutura**: 8-12 parágrafos com subtítulos internos em maiúsculas
- **Conteúdo**: Contexto histórico, análise tática, opinião, projeções
- **Imagem**: Thumbnail real de partida (YouTube via AllSportsApi)
- **Autoria**: "Redação Papo de Bola"
- **URL**: `/artigos/{slug-do-titulo}.html`

### Micro API (api/server.js):
| Endpoint | Método | Auth | Descrição |
|---|---|---|---|
| `/pdb-api/login` | POST | Não | Login (retorna token JWT-like) |
| `/pdb-api/articles` | GET | Sim | Listar artigos (paginação) |
| `/pdb-api/articles` | POST | Sim | Criar artigo |
| `/pdb-api/articles/{slug}` | PUT | Sim | Editar artigo |
| `/pdb-api/articles/{slug}` | DELETE | Sim | Excluir artigo |
| `/pdb-api/upload` | POST | Sim | Upload imagem (base64) |
| `/pdb-api/users` | GET | Admin | Listar usuários |
| `/pdb-api/users` | POST | Admin | Criar usuário |

### Roles:
- **admin**: Acesso total (artigos + usuários + configurações + API keys)
- **editor**: Pode criar, editar e excluir artigos

## Servidor e Deploy

### Conexão SSH:
```bash
ssh -i ~/.ssh/debian_ed25519 -p 1822 ivan@138.117.60.14
```

### Diretórios:
- Site: `/home/ivan/site-papodebola`
- Nginx config: `/opt/signsimples/nginx/nginx.conf`
- SSL certs: `/opt/signsimples/nginx/ssl-papodebola/`

### Serviços:
- **papodebola-api**: systemd service (Node.js porta 5055)
- **nginx**: Docker container `signsimples-nginx-1` (portas 80/443/8090)
- **cron**: `update.sh` a cada 30 minutos

### Deploy:
```bash
# Opção 1: Script
bash deploy.sh

# Opção 2: Manual
git push origin main
ssh -i ~/.ssh/debian_ed25519 -p 1822 ivan@138.117.60.14 "cd /home/ivan/site-papodebola && git pull && sudo systemctl restart papodebola-api"
```

### Cache-busting:
Ao alterar CSS ou JS, incrementar o `?v=N` em todos os HTMLs para forçar o Cloudflare a buscar a versão nova.

### Nginx:
O nginx roda dentro do Docker do signsimples. Para aplicar mudanças no nginx.conf:
```bash
# Recriar o container (reload simples NÃO funciona para config montado via volume)
cd /opt/signsimples && sudo docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

## Proxy de Imagens

O nginx faz proxy para imagens do Sofascore, adicionando o header Referer para evitar bloqueio:
- `/img/player/{id}/image` → `api.sofascore.app/api/v1/player/{id}/image`
- `/img/team/{id}/image` → `api.sofascore.app/api/v1/team/{id}/image`

Cache: 7 dias no nginx.

## Design

- **Tema**: Light (inspirado no ge.globo.com)
- **Cor primária**: Verde esportivo `#00965E`
- **Cor live**: Vermelho `#E8312A`
- **Fundo**: `#F2F3F5` (cinza claro)
- **Cards**: `#FFFFFF` com bordas `#E2E5E9`
- **Fonte display**: Oswald (headers, scores, labels)
- **Fonte body**: Inter weight 400 (texto, parágrafos)
- **Favicon**: SVG com bola de futebol no verde do site

## Painel Admin

- **Acesso**: Engrenagem no header ou `Ctrl+Shift+A`
- **Login padrão**: admin / admin123
- **Sessão**: 4 horas (hash SHA256 com salt)
- **Abas**: Jogos | Gerenciar | Artigos | Usuários | Config

## Checklist para Novos Desenvolvedores

1. Clone o repo: `git clone https://github.com/ivanalvesai/site-papodebola.git`
2. As API keys estão hardcoded em `js/config.js` (AllSportsApi) e `cache/build-articles.js` (referência ao .env do servidor)
3. Para rodar localmente, os caches precisam existir em `/cache/*.json`
4. O cron e a micro API só rodam no servidor
5. Ao fazer alterações visuais, incrementar `?v=N` nos assets
6. Após push, fazer pull no servidor e Purge no Cloudflare se necessário
