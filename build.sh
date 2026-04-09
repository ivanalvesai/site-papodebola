#!/bin/bash
# Minify CSS and JS for production
# Requires: npm install -g clean-css-cli terser (optional)

SITE_DIR="/home/ivan/site-papodebola"

# Simple minification without external tools
# Remove comments and unnecessary whitespace from CSS
if command -v npx &> /dev/null; then
    echo "Minifying CSS..."
    cp "$SITE_DIR/css/style.css" "$SITE_DIR/css/style.src.css"
    npx clean-css-cli "$SITE_DIR/css/style.src.css" -o "$SITE_DIR/css/style.min.css" 2>/dev/null
    if [ -f "$SITE_DIR/css/style.min.css" ] && [ -s "$SITE_DIR/css/style.min.css" ]; then
        echo "CSS minified: $(wc -c < "$SITE_DIR/css/style.src.css") -> $(wc -c < "$SITE_DIR/css/style.min.css") bytes"
    fi
fi

echo "Build complete"
