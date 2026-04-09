#!/bin/bash
# =====================================================
# PAPO DE BOLA - Cache Updater
# Busca dados da FootApi e salva como JSON estático
# Roda via cron a cada 1-2 horas
# =====================================================

CACHE_DIR="/home/ivan/site-papodebola/cache"
API_KEY="b46d00e4d2mshf5f1ff9d60f4a0dp17c20ajsnaf486faf891a"
API_HOST="footapi7.p.rapidapi.com"
BASE_URL="https://footapi7.p.rapidapi.com/api"
LOG_FILE="$CACHE_DIR/update.log"

TODAY=$(date +%Y-%m-%d)
TOMORROW=$(date -d "+1 day" +%Y-%m-%d)
DAY=$(date +%-d)
MONTH=$(date +%-m)
YEAR=$(date +%Y)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

fetch() {
    local endpoint="$1"
    local output="$2"
    local url="${BASE_URL}/${endpoint}"

    local http_code
    http_code=$(curl -s -w "%{http_code}" -o "$output.tmp" \
        "$url" \
        -H "x-rapidapi-key: ${API_KEY}" \
        -H "x-rapidapi-host: ${API_HOST}" \
        -H "Accept: application/json")

    if [ "$http_code" = "200" ]; then
        # Only overwrite if we got valid JSON with data
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

# 1. Live matches (most important)
fetch "matches/live" "$CACHE_DIR/live.json"

# 2. Today's matches
fetch "matches/${DAY}/${MONTH}/${YEAR}" "$CACHE_DIR/today.json"

# 3. Tomorrow's matches
TDAY=$(date -d "+1 day" +%-d)
TMONTH=$(date -d "+1 day" +%-m)
TYEAR=$(date -d "+1 day" +%Y)
fetch "matches/${TDAY}/${TMONTH}/${TYEAR}" "$CACHE_DIR/tomorrow.json"

# 4. Brasileirão standings (tournament 325, season 87678)
fetch "tournament/325/season/87678/standings/total" "$CACHE_DIR/standings_brasileirao.json"

# 5. Brasileirão statistics (top scorers)
fetch "tournament/325/season/87678/statistics" "$CACHE_DIR/stats_brasileirao.json"

# Write timestamp
echo "{\"updated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"next\":\"$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)\"}" > "$CACHE_DIR/meta.json"

log "=== Update finished (5 calls used) ==="
