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

# 5. Top scorers - fetch from top 10 teams (once every 6 hours to save quota)
if [ ! -f "$CACHE_DIR/scorers_brasileirao.json" ] || [ $((HOUR % 6)) -eq 0 ]; then
    log "Fetching top scorers from teams..."

    # Get team IDs from standings
    TEAM_IDS=$(cat "$CACHE_DIR/standings_brasileirao.json" 2>/dev/null | \
        node -e "
            const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
            const ids = d.standings[0].rows.slice(0,10).map(r => r.team.id);
            console.log(ids.join(','));
        " 2>/dev/null)

    if [ -n "$TEAM_IDS" ]; then
        ALL_SCORERS="[]"
        IFS=',' read -ra IDS <<< "$TEAM_IDS"
        for TEAM_ID in "${IDS[@]}"; do
            RESULT=$(curl -s --max-time 15 \
                "${BASE_URL}/team/${TEAM_ID}/tournament/325/season/87678/best-players" \
                -H "x-rapidapi-key: ${API_KEY}" \
                -H "x-rapidapi-host: ${API_HOST}" \
                -H "Accept: application/json" 2>/dev/null)

            if [ -n "$RESULT" ]; then
                ALL_SCORERS=$(echo "$ALL_SCORERS" | node -e "
                    const prev = JSON.parse(require('fs').readFileSync(0,'utf8'));
                    const data = JSON.parse(process.argv[1]);
                    const teamId = ${TEAM_ID};
                    if (data.topPlayers?.goals) {
                        data.topPlayers.goals.forEach(p => {
                            prev.push({
                                player: { id: p.player.id, name: p.player.name, shortName: p.player.shortName },
                                team: { id: teamId, name: p.player.team?.name || '' },
                                goals: p.statistics.goals,
                                rating: p.statistics?.rating
                            });
                        });
                    }
                    console.log(JSON.stringify(prev));
                " "$RESULT" 2>/dev/null)
            fi
            log "OK: team/${TEAM_ID}/best-players"
        done

        # Sort by goals and save top 15
        echo "$ALL_SCORERS" | node -e "
            const scorers = JSON.parse(require('fs').readFileSync(0,'utf8'));
            scorers.sort((a,b) => (b.goals||0) - (a.goals||0));
            const unique = [];
            const seen = new Set();
            scorers.forEach(s => {
                if (!seen.has(s.player.id)) {
                    seen.add(s.player.id);
                    unique.push(s);
                }
            });
            console.log(JSON.stringify({ topScorers: unique.slice(0, 15) }));
        " > "$CACHE_DIR/scorers_brasileirao.json" 2>/dev/null

        log "OK: scorers consolidated ($(cat $CACHE_DIR/scorers_brasileirao.json | wc -c) bytes)"
    fi
fi

# Write timestamp
echo "{\"updated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$CACHE_DIR/meta.json"

log "=== Update finished ==="
