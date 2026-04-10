#!/bin/bash
# =====================================================
# PAPO DE BOLA - Cache Updater
# CBF API (gratuita) + AllSportsApi Pro (10.000 req/mês, fallback)
# Roda via cron a cada 30 minutos
#
# Consumo AllSportsApi: ~130 req/dia (~3.900/mês, 39% do plano Pro)
# Consumo CBF API: ~6 req/dia (grátis, calendário)
# API-Football: DESATIVADA (plano grátis só tem 2022-2024)
#
# Horários de cada tarefa:
#   08h: today + tomorrow + artilheiros + campeonatos + CBF
#   14h: homepage
#   16h: esportes
#   22h: campeonatos
#   Standings: Ter/Qua 19:30-20:30 (2x) | Sáb/Dom 16-21h (6x)
#
# DESATIVADO: matches/live (Ao Vivo) — reativar quando necessário
# =====================================================

CACHE_DIR="/home/ivan/site-papodebola/cache"
API_KEY="cf85a77dbbmsh438760ef71d5715p13923fjsnc2f2878572d2"
API_HOST="allsportsapi2.p.rapidapi.com"
BASE_URL="https://allsportsapi2.p.rapidapi.com/api"
LOG_FILE="$CACHE_DIR/update.log"

DAY=$(date +%-d)
MONTH=$(date +%-m)
YEAR=$(date +%Y)

TDAY=$(date -d "+1 day" +%-d)
TMONTH=$(date -d "+1 day" +%-m)
TYEAR=$(date -d "+1 day" +%Y)

HOUR=$(date +%-H)
MIN=$(date +%-M)
DOW=$(date +%u)  # 1=segunda, 2=terça, ..., 6=sábado, 7=domingo

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

fetch() {
    local endpoint="$1"
    local output="$2"
    local url="${BASE_URL}/${endpoint}"

    local http_code
    http_code=$(curl -s -w "%{http_code}" -o "$output.tmp" \
        --max-time 30 \
        "$url" \
        -H "x-rapidapi-key: ${API_KEY}" \
        -H "x-rapidapi-host: ${API_HOST}" \
        -H "Accept: application/json")

    if [ "$http_code" = "200" ]; then
        local size
        size=$(stat -c%s "$output.tmp" 2>/dev/null || echo "0")
        if [ "$size" -gt 10 ]; then
            mv "$output.tmp" "$output"
            log "OK: $endpoint ($size bytes)"
            return 0
        fi
    fi

    rm -f "$output.tmp"
    log "FAIL: $endpoint (HTTP $http_code)"
    return 1
}

# =====================================================
log "=== Update started (hora: $HOUR:$MIN, dow: $DOW) ==="

# =====================================================
# JOGOS DE HOJE + AMANHÃ — AllSportsApi 1x/dia às 08h (2 req)
# =====================================================
if [ "$HOUR" -eq 8 ] && [ "$MIN" -lt 30 ]; then
    # DESATIVADO: Ao Vivo (reativar futuramente)
    # fetch "matches/live" "$CACHE_DIR/live.json"

    log "Fetching today + tomorrow matches (08h)..."
    fetch "matches/${DAY}/${MONTH}/${YEAR}" "$CACHE_DIR/today.json"
    fetch "matches/${TDAY}/${TMONTH}/${TYEAR}" "$CACHE_DIR/tomorrow.json"
fi

# =====================================================
# CBF API — Calendário do futebol brasileiro (GRATUITA)
# 2x/dia: 08h e 20h (datas, horários, estádios — próximos jogos)
# =====================================================
if ([ "$HOUR" -eq 8 ] || [ "$HOUR" -eq 20 ]) && [ "$MIN" -lt 30 ]; then
    log "Building CBF calendar..."
    node "$CACHE_DIR/build-cbf.js" >> "$LOG_FILE" 2>&1 || log "WARN: CBF calendar failed"
    log "OK: CBF calendar cached"
fi

# =====================================================
# STANDINGS BRASILEIRÃO — AllSportsApi em dias de jogo
# Ter/Qua: 2x após 19:30 | Sáb/Dom: 6x após 16h
# =====================================================
FETCH_STANDINGS=false
if [ "$DOW" -eq 2 ] || [ "$DOW" -eq 3 ]; then
    if [ "$HOUR" -eq 20 ] || ([ "$HOUR" -eq 21 ] && [ "$MIN" -lt 30 ]); then
        FETCH_STANDINGS=true
    fi
fi
if [ "$DOW" -eq 6 ] || [ "$DOW" -eq 7 ]; then
    if [ "$HOUR" -ge 16 ] && [ "$HOUR" -le 21 ] && [ "$MIN" -lt 30 ]; then
        FETCH_STANDINGS=true
    fi
fi
if [ "$FETCH_STANDINGS" = true ]; then
    log "Fetching standings (dia de jogo)..."
    fetch "tournament/325/season/87678/standings/total" "$CACHE_DIR/standings_brasileirao.json"
fi

# =====================================================
# ARTILHEIROS — 1x/dia às 08h (10 req AllSportsApi)
# =====================================================
if [ "$HOUR" -eq 8 ] && [ "$MIN" -lt 30 ]; then
    log "Fetching top scorers (08h)..."
    node "$CACHE_DIR/build-scorers.js" >> "$LOG_FILE" 2>&1
    SCORERS_FILE="$CACHE_DIR/scorers_brasileirao.json"
    log "OK: scorers ($(stat -c%s $SCORERS_FILE 2>/dev/null || echo 0) bytes)"
fi

# DESATIVADO: API-Football (plano grátis só tem dados de 2022-2024)
# Para reativar: registrar plano pago em dashboard.api-football.com
# e descomentar a linha abaixo:
# APIFOOTBALL_KEY=xxx node "$CACHE_DIR/build-apifootball.js"

# =====================================================
# HOMEPAGE — 1x/dia às 14h (15 req)
# =====================================================
if [ "$HOUR" -eq 14 ] && [ "$MIN" -lt 30 ]; then
    log "Building homepage content (14h)..."
    node "$CACHE_DIR/build-home.js" >> "$LOG_FILE" 2>&1
    HOME_FILE="$CACHE_DIR/home.json"
    log "OK: home ($(stat -c%s $HOME_FILE 2>/dev/null || echo 0) bytes)"
fi

# =====================================================
# ARTIGOS — 1 por slot, 10 slots/dia em horários de pico
# =====================================================
PUBLISH_SLOTS="7:00 8:30 10:00 11:30 13:00 14:30 16:00 18:00 20:00 21:30"
SHOULD_PUBLISH=false
for slot in $PUBLISH_SLOTS; do
    SLOT_H=$(echo $slot | cut -d: -f1)
    SLOT_M=$(echo $slot | cut -d: -f2)
    if [ "$HOUR" -eq "$SLOT_H" ] && [ "$MIN" -lt 30 ] && [ "$SLOT_M" = "00" ]; then
        SHOULD_PUBLISH=true
    elif [ "$HOUR" -eq "$SLOT_H" ] && [ "$MIN" -ge 30 ] && [ "$SLOT_M" = "30" ]; then
        SHOULD_PUBLISH=true
    fi
done

if [ "$SHOULD_PUBLISH" = true ] || [ ! -f "$CACHE_DIR/articles.json" ]; then
    log "Publishing article (slot: $HOUR:$(date +%M))..."
    export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    export HUGGINGFACE_TOKEN=$(grep "^HUGGINGFACE_TOKEN=" /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    export HUGGINGFACE_TOKEN_2=$(grep "^HUGGINGFACE_TOKEN_2=" /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    export HUGGINGFACE_TOKEN_3=$(grep "^HUGGINGFACE_TOKEN_3=" /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    MAX_ARTICLES=1 node "$CACHE_DIR/build-articles.js" >> "$LOG_FILE" 2>&1
    log "OK: article published"
fi

# WordPress sync + SEO (every 30 min, sem custo de API)
log "Syncing WordPress..."
node "$CACHE_DIR/sync-wordpress.js" >> "$LOG_FILE" 2>&1
log "OK: wordpress synced"

docker cp "$CACHE_DIR/apply-seo-complete.php" wordpress-papodebola-wordpress-1:/tmp/ 2>/dev/null
docker exec wordpress-papodebola-wordpress-1 wp eval-file /tmp/apply-seo-complete.php --allow-root >> "$LOG_FILE" 2>&1
log "OK: SEO applied to new posts"

# =====================================================
# ESPORTES — 1x/dia às 16h (~45 req)
# =====================================================
if [ "$HOUR" -eq 16 ] && [ "$MIN" -lt 30 ]; then
    log "Building sports cache (16h)..."
    node "$CACHE_DIR/build-sports.js" >> "$LOG_FILE" 2>&1
    log "OK: sports cached"
fi

# =====================================================
# CAMPEONATOS — 2x/dia às 08h e 22h (~28 req AllSportsApi)
# Brasileirão, Copa do Brasil, Libertadores, Champions
# =====================================================
if ([ "$HOUR" -eq 8 ] || [ "$HOUR" -eq 22 ]) && [ "$MIN" -lt 30 ]; then
    log "Building championship cache..."
    node "$CACHE_DIR/build-championship.js" >> "$LOG_FILE" 2>&1
    log "OK: championships cached"
fi

# Sitemap - handled by Rank Math WordPress plugin
# Sitemap URL: https://admin.papodebola.com.br/sitemap_index.xml

# Write timestamp
echo "{\"updated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$CACHE_DIR/meta.json"

log "=== Update finished ==="
