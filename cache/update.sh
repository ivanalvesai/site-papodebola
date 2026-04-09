#!/bin/bash
# =====================================================
# PAPO DE BOLA - Cache Updater
# AllSportsApi Pro - roda via cron a cada 30 minutos
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
log "=== Update started ==="

# 1. Live matches (always)
fetch "matches/live" "$CACHE_DIR/live.json"

# 2. Today's matches (always)
fetch "matches/${DAY}/${MONTH}/${YEAR}" "$CACHE_DIR/today.json"

# 3. Tomorrow's matches (always)
fetch "matches/${TDAY}/${TMONTH}/${TYEAR}" "$CACHE_DIR/tomorrow.json"

# 4. Brasileirão standings (always)
fetch "tournament/325/season/87678/standings/total" "$CACHE_DIR/standings_brasileirao.json"

# 5. Top scorers (every 6 hours)
SCORERS_FILE="$CACHE_DIR/scorers_brasileirao.json"
SCORERS_SIZE=$(stat -c%s "$SCORERS_FILE" 2>/dev/null || echo "0")
if [ "$SCORERS_SIZE" -lt 20 ] || [ $((HOUR % 6)) -eq 0 ]; then
    log "Fetching top scorers..."
    node "$CACHE_DIR/build-scorers.js" >> "$LOG_FILE" 2>&1
    log "OK: scorers ($(stat -c%s $SCORERS_FILE 2>/dev/null || echo 0) bytes)"
fi

# 6. Homepage content - highlights, transfers, news (every 3 hours)
HOME_FILE="$CACHE_DIR/home.json"
HOME_SIZE=$(stat -c%s "$HOME_FILE" 2>/dev/null || echo "0")
if [ "$HOME_SIZE" -lt 20 ] || [ $((HOUR % 3)) -eq 0 ]; then
    log "Building homepage content..."
    node "$CACHE_DIR/build-home.js" >> "$LOG_FILE" 2>&1
    log "OK: home ($(stat -c%s $HOME_FILE 2>/dev/null || echo 0) bytes)"
fi

# 7. Articles - fetch, rewrite with Claude, generate pages (every 3 hours)
if [ $((HOUR % 3)) -eq 0 ] || [ ! -f "$CACHE_DIR/articles.json" ]; then
    log "Building articles..."
    export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    export HUGGINGFACE_TOKEN=$(grep "^HUGGINGFACE_TOKEN=" /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    export HUGGINGFACE_TOKEN_2=$(grep "^HUGGINGFACE_TOKEN_2=" /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    export HUGGINGFACE_TOKEN_3=$(grep "^HUGGINGFACE_TOKEN_3=" /home/ivan/automacao-site/.env 2>/dev/null | cut -d= -f2)
    node "$CACHE_DIR/build-articles.js" >> "$LOG_FILE" 2>&1
    log "OK: articles ($(stat -c%s $CACHE_DIR/articles.json 2>/dev/null || echo 0) bytes)"
fi

# Write timestamp
echo "{\"updated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$CACHE_DIR/meta.json"

log "=== Update finished ==="
