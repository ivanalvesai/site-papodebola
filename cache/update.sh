#!/bin/bash
# =====================================================
# PAPO DE BOLA - Cache Updater
# AllSportsApi Pro (10.000 req/mês)
# Roda via cron a cada 30 minutos
#
# Consumo estimado: ~331 req/dia (~9.930/mês)
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
log "=== Update started (hora: $HOUR:$MIN) ==="

# =====================================================
# FUTEBOL - 08h-23h, a cada 30 min (3 req: today + tomorrow + standings)
# AO VIVO desativado (matches/live) — reativar quando necessário
# =====================================================
if [ "$HOUR" -ge 8 ] && [ "$HOUR" -le 23 ]; then
    # DESATIVADO: Ao Vivo (reativar futuramente)
    # fetch "matches/live" "$CACHE_DIR/live.json"

    # 1. Today's matches (jogos do dia, sem placar ao vivo)
    fetch "matches/${DAY}/${MONTH}/${YEAR}" "$CACHE_DIR/today.json"

    # 2. Tomorrow's matches
    fetch "matches/${TDAY}/${TMONTH}/${TYEAR}" "$CACHE_DIR/tomorrow.json"

    # 3. Brasileirão standings
    fetch "tournament/325/season/87678/standings/total" "$CACHE_DIR/standings_brasileirao.json"
else
    log "Fora do horário ativo (08h-23h), pulando..."
fi

# =====================================================
# ARTILHEIROS - 1x/dia às 08h (10 req)
# =====================================================
if [ "$HOUR" -eq 8 ] && [ "$MIN" -lt 30 ]; then
    log "Fetching top scorers (08h)..."
    node "$CACHE_DIR/build-scorers.js" >> "$LOG_FILE" 2>&1
    SCORERS_FILE="$CACHE_DIR/scorers_brasileirao.json"
    log "OK: scorers ($(stat -c%s $SCORERS_FILE 2>/dev/null || echo 0) bytes)"
fi

# =====================================================
# HOMEPAGE - 1x/dia às 14h (15 req)
# =====================================================
if [ "$HOUR" -eq 14 ] && [ "$MIN" -lt 30 ]; then
    log "Building homepage content (14h)..."
    node "$CACHE_DIR/build-home.js" >> "$LOG_FILE" 2>&1
    HOME_FILE="$CACHE_DIR/home.json"
    log "OK: home ($(stat -c%s $HOME_FILE 2>/dev/null || echo 0) bytes)"
fi

# =====================================================
# ARTIGOS - 1 por slot, 10 slots/dia em horários de pico
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
# ESPORTES - 1x/dia às 16h (~45 req)
# =====================================================
if [ "$HOUR" -eq 16 ] && [ "$MIN" -lt 30 ]; then
    log "Building sports cache (16h)..."
    node "$CACHE_DIR/build-sports.js" >> "$LOG_FILE" 2>&1
    log "OK: sports cached"
fi

# =====================================================
# CAMPEONATOS - cada 3h, 08h-23h (~28 req)
# =====================================================
if [ "$HOUR" -ge 8 ] && [ "$HOUR" -le 23 ]; then
    if [ $((HOUR % 3)) -eq 0 ] && [ "$MIN" -lt 30 ]; then
        log "Building championship cache..."
        node "$CACHE_DIR/build-championship.js" >> "$LOG_FILE" 2>&1
        log "OK: championships cached"
    fi
fi

# Sitemap - handled by Rank Math WordPress plugin
# Sitemap URL: https://admin.papodebola.com.br/sitemap_index.xml

# Write timestamp
echo "{\"updated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$CACHE_DIR/meta.json"

log "=== Update finished ==="
