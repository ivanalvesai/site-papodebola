#!/bin/bash
# =====================================================
# PAPO DE BOLA - Cache Updater
# AllSportsApi Pro - roda via cron a cada 30 minutos
# Futebol: 08h-23h (30 em 30 min) | Esportes: 08h, 14h, 20h
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
log "=== Update started (hora: $HOUR) ==="

# =====================================================
# FUTEBOL - só das 08h às 23h (4 req a cada 30 min)
# =====================================================
if [ "$HOUR" -ge 8 ] && [ "$HOUR" -le 23 ]; then
    # 1. Live matches
    fetch "matches/live" "$CACHE_DIR/live.json"

    # 2. Today's matches
    fetch "matches/${DAY}/${MONTH}/${YEAR}" "$CACHE_DIR/today.json"

    # 3. Tomorrow's matches
    fetch "matches/${TDAY}/${TMONTH}/${TYEAR}" "$CACHE_DIR/tomorrow.json"

    # 4. Brasileirão standings
    fetch "tournament/325/season/87678/standings/total" "$CACHE_DIR/standings_brasileirao.json"
else
    log "Fora do horário de futebol (08h-23h), pulando..."
fi

# 5. Top scorers (every 6 hours, only during active hours)
SCORERS_FILE="$CACHE_DIR/scorers_brasileirao.json"
SCORERS_SIZE=$(stat -c%s "$SCORERS_FILE" 2>/dev/null || echo "0")
if [ "$HOUR" -ge 8 ] && [ "$HOUR" -le 23 ]; then
    if [ "$SCORERS_SIZE" -lt 20 ] || [ $((HOUR % 6)) -eq 0 ]; then
        log "Fetching top scorers..."
        node "$CACHE_DIR/build-scorers.js" >> "$LOG_FILE" 2>&1
        log "OK: scorers ($(stat -c%s $SCORERS_FILE 2>/dev/null || echo 0) bytes)"
    fi
fi

# 6. Homepage content - highlights, transfers, news (every 3 hours, 08h-23h)
HOME_FILE="$CACHE_DIR/home.json"
HOME_SIZE=$(stat -c%s "$HOME_FILE" 2>/dev/null || echo "0")
if [ "$HOUR" -ge 8 ] && [ "$HOUR" -le 23 ]; then
    if [ "$HOME_SIZE" -lt 20 ] || [ $((HOUR % 3)) -eq 0 ]; then
        log "Building homepage content..."
        node "$CACHE_DIR/build-home.js" >> "$LOG_FILE" 2>&1
        log "OK: home ($(stat -c%s $HOME_FILE 2>/dev/null || echo 0) bytes)"
    fi
fi

# 7. Articles - 1 article per scheduled slot, 10 slots/day in peak hours
# Horários de pico (BR): 7:00, 8:30, 10:00, 11:30, 13:00, 14:30, 16:00, 18:00, 20:00, 21:30
CURRENT_TIME="${HOUR}:$(date +%M)"
PUBLISH_SLOTS="7:00 8:30 10:00 11:30 13:00 14:30 16:00 18:00 20:00 21:30"
SHOULD_PUBLISH=false
for slot in $PUBLISH_SLOTS; do
    if [ "$HOUR" -eq "$(echo $slot | cut -d: -f1)" ] && [ "$(date +%M)" -lt "30" ] && [ "$(echo $slot | cut -d: -f2)" = "00" ]; then
        SHOULD_PUBLISH=true
    elif [ "$HOUR" -eq "$(echo $slot | cut -d: -f1)" ] && [ "$(date +%M)" -ge "30" ] && [ "$(echo $slot | cut -d: -f2)" = "30" ]; then
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

# 7b. Sync WordPress posts to front-end cache (every 30 min, always)
log "Syncing WordPress..."
node "$CACHE_DIR/sync-wordpress.js" >> "$LOG_FILE" 2>&1
log "OK: wordpress synced"

# 7c. Apply COMPLETE SEO to new posts without Rank Math meta (every 30 min, always)
docker cp "$CACHE_DIR/apply-seo-complete.php" wordpress-papodebola-wordpress-1:/tmp/ 2>/dev/null
docker exec wordpress-papodebola-wordpress-1 wp eval-file /tmp/apply-seo-complete.php --allow-root >> "$LOG_FILE" 2>&1
log "OK: SEO applied to new posts"

# =====================================================
# ESPORTES - apenas às 08h, 14h e 20h
# =====================================================
if [ "$HOUR" -eq 8 ] || [ "$HOUR" -eq 14 ] || [ "$HOUR" -eq 20 ]; then
    if [ "$(date +%M)" -lt "30" ]; then
        log "Building sports cache (08h/14h/20h)..."
        node "$CACHE_DIR/build-sports.js" >> "$LOG_FILE" 2>&1
        log "OK: sports cached"
    fi
fi

# 9. Championship data (every 3 hours, 08h-23h)
CHAMP_FILE="$CACHE_DIR/champ_325.json"
CHAMP_SIZE=$(stat -c%s "$CHAMP_FILE" 2>/dev/null || echo "0")
if [ "$HOUR" -ge 8 ] && [ "$HOUR" -le 23 ]; then
    if [ "$CHAMP_SIZE" -lt 20 ] || [ $((HOUR % 3)) -eq 0 ]; then
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
