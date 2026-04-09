/**
 * Shared article HTML template
 * Used by api/server.js and cache/build-articles.js
 */
function generateArticleHTML(article) {
    const dateFormatted = article.pubDate
        ? new Date(article.pubDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Reading time estimate (200 words per minute)
    const wordCount = (article.rewrittenText || '').split(/\s+/).filter(w => w.length > 0).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    const dateISO = article.pubDate
        ? new Date(article.pubDate).toISOString()
        : new Date().toISOString();

    const title = (article.rewrittenTitle || '').replace(/"/g, '&quot;');
    const desc = (article.rewrittenText || '').substring(0, 155).replace(/"/g, '&quot;').replace(/\n/g, ' ');
    const category = article.category || 'Futebol Brasileiro';
    const author = article.author || 'Redação Papo de Bola';
    const slug = article.slug || '';
    const articleUrl = `https://papodebola.com.br/artigos/${slug}.html`;

    const paragraphs = (article.rewrittenText || '')
        .split(/\n\n|\n/)
        .filter(p => p.trim())
        .map(p => {
            let text = p.trim();
            // Bold subtitles: lines starting with ALL CAPS words followed by - or :
            text = text.replace(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇÜ][A-ZÁÉÍÓÚÂÊÔÃÕÇÜ\s,]{4,})\s*[-–—:]\s*/,
                '<strong>$1</strong> — ');
            return `<p>${text}</p>`;
        })
        .join('\n                    ');

    const imageTag = article.image
        ? `<img src="${article.image}" alt="${title}" loading="lazy" onerror="this.style.display='none'">`
        : '';

    const imageSchema = article.image
        ? `"image": "${article.image.startsWith('http') ? article.image : 'https://papodebola.com.br' + article.image}",`
        : '';

    const shareUrl = encodeURIComponent(articleUrl);
    const shareTitle = encodeURIComponent(article.rewrittenTitle || '');

    // Build tags HTML
    const tags = article.tags || [];
    const tagsHtml = tags.length > 0 ? `
            <div class="article-tags">
                ${tags.map(t => `<a href="../pages/noticias.html?cat=${encodeURIComponent(t)}" class="article-tag"><i class="fas fa-tag"></i> ${t.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</a>`).join('')}
                <a href="../pages/noticias.html?cat=${encodeURIComponent(category)}" class="article-tag"><i class="fas fa-trophy"></i> ${category}</a>
            </div>` : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${desc}">
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <link rel="manifest" href="../manifest.json">
    <meta name="theme-color" content="#00965E">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${articleUrl}">
    <meta property="og:site_name" content="Papo de Bola">
    <meta property="og:locale" content="pt_BR">
    ${article.image ? `<meta property="og:image" content="${article.image.startsWith('http') ? article.image : 'https://papodebola.com.br' + article.image}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <title>${article.rewrittenTitle || 'Artigo'} - Papo de Bola</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css?v=15">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "${title}",
        "description": "${desc}",
        ${imageSchema}
        "datePublished": "${dateISO}",
        "dateModified": "${article.updatedAt || dateISO}",
        "author": { "@type": "Organization", "name": "${author}" },
        "publisher": {
            "@type": "Organization",
            "name": "Papo de Bola",
            "logo": { "@type": "ImageObject", "url": "https://papodebola.com.br/favicon.svg" }
        },
        "mainEntityOfPage": "${articleUrl}",
        "articleSection": "${category}"
    }
    </script>
    <style>
        .article-hero { background: #fff; border-bottom: 1px solid #E2E5E9; padding: 40px 0 32px; }
        .article-hero img { width: 100%; max-height: 480px; object-fit: cover; border-radius: 4px; margin-bottom: 28px; }
        .article-category { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #00965E; margin-bottom: 16px; }
        .article-category a { color: #00965E; }
        .article-category a:hover { text-decoration: underline; }
        .article-breadcrumb { font-size: 12px; color: #8896A6; margin-bottom: 16px; }
        .article-breadcrumb a { color: #8896A6; }
        .article-breadcrumb a:hover { color: #00965E; }
        .article-breadcrumb span { margin: 0 6px; }
        .article-title { font-size: 34px; font-weight: 700; line-height: 1.25; margin-bottom: 20px; color: #1A1D23; text-transform: none; }
        .article-meta { font-size: 14px; color: #8896A6; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid #EEF0F2; }
        .reading-time { display: flex; align-items: center; gap: 4px; }
        .related-articles { max-width: 680px; margin: 0 auto; padding: 32px 0; border-top: 2px solid #E2E5E9; }
        .related-title { font-size: 16px; font-weight: 700; text-transform: uppercase; color: #1A1D23; margin-bottom: 20px; }
        .related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .related-card { background: #fff; border: 1px solid #E2E5E9; border-radius: 8px; overflow: hidden; transition: all 0.2s; }
        .related-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
        .related-card img { width: 100%; height: 120px; object-fit: cover; }
        .related-card .rc-body { padding: 12px; }
        .related-card .rc-cat { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #00965E; margin-bottom: 4px; }
        .related-card .rc-title { font-size: 14px; font-weight: 600; line-height: 1.3; color: #1A1D23; }
        @media (max-width: 768px) { .related-grid { grid-template-columns: 1fr; } }
        .article-content { padding: 48px 0 40px; max-width: 680px; margin: 0 auto; }
        .article-content p {
            font-size: 18px;
            font-weight: 400;
            line-height: 2;
            color: #333;
            margin-bottom: 32px;
            text-align: left;
        }
        .article-content p strong {
            font-weight: 700;
            color: #1A1D23;
            font-size: 17px;
            letter-spacing: 0.02em;
        }
        .article-back { display: inline-flex; align-items: center; gap: 6px; color: #00965E; font-weight: 600; font-size: 14px; margin-bottom: 24px; }
        .article-back:hover { text-decoration: underline; }
        .share-bar { max-width: 680px; margin: 0 auto; padding: 32px 0 48px; border-top: 2px solid #E2E5E9; }
        .share-bar h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #8896A6; margin-bottom: 16px; }
        .share-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
        .share-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; color: white; text-decoration: none; transition: all 0.2s; }
        .share-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .share-btn.whatsapp { background: #25D366; }
        .share-btn.twitter { background: #1DA1F2; }
        .share-btn.facebook { background: #1877F2; }
        .share-btn.telegram { background: #0088cc; }
        .share-btn.copy { background: #4A5568; cursor: pointer; border: none; font-family: inherit; }
        .article-tags { max-width: 680px; margin: 0 auto; padding: 0 0 24px; display: flex; gap: 8px; flex-wrap: wrap; }
        .article-tag { display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; background: #F2F3F5; border: 1px solid #E2E5E9; border-radius: 100px; font-size: 12px; font-weight: 600; color: #4A5568; text-decoration: none; transition: all 0.2s; }
        .article-tag:hover { background: #00965E; color: white; border-color: #00965E; }
        .article-tag i { font-size: 10px; }
        @media (max-width: 768px) {
            .article-title { font-size: 26px; }
            .article-content p { font-size: 17px; line-height: 1.9; margin-bottom: 28px; }
            .article-content { padding: 32px 0 32px; }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-top"><div class="container"><div class="header-top-content">
            <div class="logo"><a href="../index.html"><i class="fas fa-futbol logo-icon"></i><span class="logo-text">PAPO <span class="logo-accent">DE BOLA</span></span></a></div>
        </div></div></div>
        <nav class="main-nav"><div class="container"><ul class="nav-list">
            <li class="nav-item"><a href="../index.html" class="nav-link">Início</a></li>
            <li class="nav-item"><a href="../pages/noticias.html" class="nav-link">Notícias</a></li>
            <li class="nav-item"><a href="../pages/ao-vivo.html" class="nav-link live-link"><span class="live-dot"></span> AO VIVO</a></li>
        </ul></div></nav>
    </header>
    <main>
        <section class="article-hero"><div class="container">
            <div class="article-breadcrumb">
                <a href="../index.html">Início</a><span>›</span>
                <a href="../pages/noticias.html">Notícias</a><span>›</span>
                <a href="../pages/noticias.html?cat=${encodeURIComponent(category)}">${category}</a>
            </div>
            ${imageTag}
            <div class="article-category"><a href="../pages/noticias.html?cat=${encodeURIComponent(category)}">${category}</a></div>
            <h1 class="article-title">${article.rewrittenTitle || ''}</h1>
            <div class="article-meta">
                <span><i class="fas fa-clock"></i> ${dateFormatted}</span>
                <span><i class="fas fa-pen"></i> ${author}</span>
                <span class="reading-time"><i class="fas fa-book-open"></i> ${readingTime} min de leitura</span>
            </div>
        </div></section>
        <div class="container">
            <article class="article-content">${paragraphs}</article>
            ${tagsHtml}
            <div class="share-bar">
                <h4>Compartilhar</h4>
                <div class="share-buttons">
                    <a href="https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener" class="share-btn whatsapp"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                    <a href="https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}" target="_blank" rel="noopener" class="share-btn twitter"><i class="fab fa-x-twitter"></i> X</a>
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" class="share-btn facebook"><i class="fab fa-facebook-f"></i> Facebook</a>
                    <a href="https://t.me/share/url?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="noopener" class="share-btn telegram"><i class="fab fa-telegram-plane"></i> Telegram</a>
                    <button class="share-btn copy" onclick="navigator.clipboard.writeText('${articleUrl}');this.innerHTML='<i class=\\'fas fa-check\\'></i> Copiado!';setTimeout(()=>this.innerHTML='<i class=\\'fas fa-link\\'></i> Copiar Link',2000)"><i class="fas fa-link"></i> Copiar Link</button>
                </div>
            </div>
        </div>
            <div class="related-articles" id="relatedArticles"></div>
        </div>
    </main>
    <footer class="footer"><div class="container"><div class="footer-bottom" style="border-top:none;padding-top:0"><p>&copy; 2026 Papo de Bola.</p></div></div></footer>
    <script>
    (async()=>{
        try{
            const r=await fetch('/cache/articles.json?_='+Date.now());
            if(!r.ok)return;
            const all=await r.json();
            const slug='${slug}';
            const tags=${JSON.stringify(article.tags||[])};
            const cat='${category}';
            const related=all.filter(a=>a.slug!==slug&&(
                (a.tags||[]).some(t=>tags.includes(t))||(a.category||'')===cat
            )).slice(0,4);
            if(!related.length)return;
            const box=document.getElementById('relatedArticles');
            box.innerHTML='<div class="related-title">Leia Também</div><div class="related-grid">'+
                related.map(a=>'<a href="/artigos/'+a.slug+'.html" class="related-card">'+
                    (a.image?'<img src="'+a.image+'" alt="" loading="lazy" onerror="this.style.display=\\'none\\'">':'')+
                    '<div class="rc-body"><div class="rc-cat">'+(a.category||'')+'</div><div class="rc-title">'+(a.rewrittenTitle||'')+'</div></div></a>'
                ).join('')+'</div>';
        }catch(e){}
    })();
    </script>
</body>
</html>`;
}

if (typeof module !== 'undefined') module.exports = { generateArticleHTML };
