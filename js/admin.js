/* =====================================================
   PAPO DE BOLA - Admin Panel with Authentication
   Only the master user can access admin features
   ===================================================== */

const Auth = {
    SESSION_KEY: 'pdb_admin_session',
    CREDENTIALS_KEY: 'pdb_admin_credentials',
    SESSION_DURATION: 4 * 60 * 60 * 1000, // 4 hours

    // Initialize default credentials if none exist
    initDefaults() {
        if (!localStorage.getItem(this.CREDENTIALS_KEY)) {
            // Default: admin / admin123 (user should change on first login)
            this.saveCredentials('admin', 'admin123');
        }
    },

    saveCredentials(username, password) {
        const hash = this.hashPassword(password);
        localStorage.setItem(this.CREDENTIALS_KEY, JSON.stringify({ username, hash }));
    },

    hashPassword(password) {
        // Simple hash for client-side (not for production-grade security)
        let hash = 0;
        const salt = 'pdb_salt_2026';
        const str = salt + password + salt;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    },

    login(username, password) {
        const stored = JSON.parse(localStorage.getItem(this.CREDENTIALS_KEY) || '{}');
        const hash = this.hashPassword(password);

        if (stored.username === username && stored.hash === hash) {
            const session = {
                loggedIn: true,
                timestamp: Date.now(),
                expires: Date.now() + this.SESSION_DURATION,
            };
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            return true;
        }
        return false;
    },

    logout() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    isLoggedIn() {
        const session = JSON.parse(localStorage.getItem('pdb_admin_session') || '{}');
        if (!session.loggedIn) return false;
        if (Date.now() > session.expires) {
            this.logout();
            return false;
        }
        return true;
    },

    changePassword(currentPassword, newPassword) {
        const stored = JSON.parse(localStorage.getItem(this.CREDENTIALS_KEY) || '{}');
        const currentHash = this.hashPassword(currentPassword);

        if (stored.hash !== currentHash) return false;

        this.saveCredentials(stored.username, newPassword);
        return true;
    },

    changeUsername(newUsername, password) {
        const stored = JSON.parse(localStorage.getItem(this.CREDENTIALS_KEY) || '{}');
        const hash = this.hashPassword(password);

        if (stored.hash !== hash) return false;

        this.saveCredentials(newUsername, password);
        return true;
    },
};

const Admin = {
    init() {
        Auth.initDefaults();
        this.bindEvents();
        this.updateAdminVisibility();
    },

    bindEvents() {
        // Admin toggle button - now shows login or panel
        const adminToggle = document.getElementById('adminToggle');
        if (adminToggle) {
            adminToggle.addEventListener('click', () => {
                if (Auth.isLoggedIn()) {
                    this.togglePanel();
                } else {
                    this.showLoginModal();
                }
            });
        }

        // Close buttons
        const adminClose = document.getElementById('adminClose');
        if (adminClose) {
            adminClose.addEventListener('click', () => this.closePanel());
        }

        const adminOverlay = document.getElementById('adminOverlay');
        if (adminOverlay) {
            adminOverlay.addEventListener('click', (e) => {
                if (e.target === adminOverlay) this.closePanel();
            });
        }

        // Admin tabs
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Game status change
        const gameStatus = document.getElementById('gameStatus');
        if (gameStatus) {
            gameStatus.addEventListener('change', () => {
                const scoreRow = document.getElementById('scoreRow');
                scoreRow.style.display = (gameStatus.value === 'live' || gameStatus.value === 'finished') ? 'grid' : 'none';
            });
        }

        // Add embed button
        const addEmbedBtn = document.getElementById('addEmbedBtn');
        if (addEmbedBtn) {
            addEmbedBtn.addEventListener('click', () => this.addEmbedField());
        }

        // Form submit
        const addGameForm = document.getElementById('addGameForm');
        if (addGameForm) {
            addGameForm.addEventListener('submit', (e) => this.handleAddGame(e));
        }

        // Save settings
        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => this.saveSettings());
        }

        // Keyboard shortcut (Ctrl+Shift+A) to open admin
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                if (Auth.isLoggedIn()) {
                    this.togglePanel();
                } else {
                    this.showLoginModal();
                }
            }
        });
    },

    // Update visibility of admin button
    updateAdminVisibility() {
        const adminToggle = document.getElementById('adminToggle');
        if (adminToggle) {
            // Always show the button but change its appearance based on login state
            if (Auth.isLoggedIn()) {
                adminToggle.style.borderColor = 'var(--accent-green)';
                adminToggle.style.color = 'var(--accent-green)';
                adminToggle.title = 'Painel Admin (Logado)';
            } else {
                adminToggle.style.borderColor = '';
                adminToggle.style.color = '';
                adminToggle.title = 'Login Admin';
            }
        }
    },

    // ==================== LOGIN MODAL ====================
    showLoginModal() {
        let modal = document.getElementById('loginModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'loginModal';
            modal.className = 'login-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="login-modal">
                <div class="login-header">
                    <div class="login-logo">
                        <i class="fas fa-futbol" style="font-size:32px;color:var(--accent-green);animation:spin 8s linear infinite"></i>
                    </div>
                    <h2>Painel Administrativo</h2>
                    <p>Acesso restrito ao administrador</p>
                </div>
                <form id="loginForm" class="login-form">
                    <div class="login-field">
                        <label><i class="fas fa-user"></i> Usuário</label>
                        <input type="text" id="loginUsername" placeholder="Digite seu usuário" required autocomplete="username">
                    </div>
                    <div class="login-field">
                        <label><i class="fas fa-lock"></i> Senha</label>
                        <div class="login-password-wrap">
                            <input type="password" id="loginPassword" placeholder="Digite sua senha" required autocomplete="current-password">
                            <button type="button" class="login-eye" onclick="Admin.togglePasswordVisibility('loginPassword', this)">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="login-error" id="loginError" style="display:none">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Usuário ou senha incorretos</span>
                    </div>
                    <button type="submit" class="login-btn">
                        <i class="fas fa-sign-in-alt"></i> Entrar
                    </button>
                </form>
                <button class="login-close" onclick="Admin.closeLoginModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        modal.classList.add('active');

        // Focus username
        setTimeout(() => document.getElementById('loginUsername')?.focus(), 100);

        // Handle form - login via API
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch('/pdb-api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                const data = await res.json();

                if (res.ok && data.token) {
                    // Save token and session
                    localStorage.setItem('pdb_api_token', data.token);
                    localStorage.setItem('pdb_admin_session', JSON.stringify({
                        loggedIn: true, username: data.username, role: data.role,
                        timestamp: Date.now(), expires: Date.now() + 14400000,
                    }));
                    this.apiToken = data.token;
                    this.closeLoginModal();
                    this.updateAdminVisibility();
                    this.togglePanel();
                    showToast(`Bem-vindo, ${data.username}!`, 'success');
                } else {
                    const errorEl = document.getElementById('loginError');
                    errorEl.style.display = 'flex';
                    document.getElementById('loginPassword').value = '';
                    document.getElementById('loginPassword').focus();
                    const modal = document.querySelector('.login-modal');
                    modal.classList.add('shake');
                    setTimeout(() => modal.classList.remove('shake'), 600);
                }
            } catch {
                showToast('Erro de conexão com o servidor', 'error');
            }
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeLoginModal();
        });

        // Close on Escape
        const handler = (e) => {
            if (e.key === 'Escape') {
                this.closeLoginModal();
                document.removeEventListener('keydown', handler);
            }
        };
        document.addEventListener('keydown', handler);
    },

    closeLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.remove('active');
    },

    togglePasswordVisibility(inputId, btn) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            input.type = 'password';
            btn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    },

    // ==================== ADMIN PANEL ====================
    togglePanel() {
        if (!Auth.isLoggedIn()) {
            this.showLoginModal();
            return;
        }
        const overlay = document.getElementById('adminOverlay');
        overlay.classList.toggle('active');
        if (overlay.classList.contains('active')) {
            this.refreshManagedGames();
            this.loadSettings();
        }
    },

    closePanel() {
        document.getElementById('adminOverlay').classList.remove('active');
    },

    switchTab(tabId) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

        document.querySelector(`.admin-tab[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');

        if (tabId === 'manage-games') this.refreshManagedGames();
        if (tabId === 'editor') this.loadArticlesList();
        if (tabId === 'users') this.loadUsersList();
    },

    // ==================== EMBED MANAGEMENT ====================
    addEmbedField() {
        const embedList = document.getElementById('embedList');
        const count = embedList.querySelectorAll('.embed-item').length + 1;

        const item = document.createElement('div');
        item.className = 'embed-item';
        item.innerHTML = `
            <span class="embed-label">Opção ${count}</span>
            <input type="text" class="embed-url" placeholder="URL do embed (iframe src)">
            <input type="text" class="embed-name" placeholder="Nome (ex: HD, Narração BR)">
            <button type="button" class="embed-remove" title="Remover"><i class="fas fa-trash"></i></button>
        `;

        item.querySelector('.embed-remove').addEventListener('click', () => {
            item.remove();
            this.reorderEmbedLabels();
        });

        embedList.appendChild(item);
    },

    reorderEmbedLabels() {
        const items = document.querySelectorAll('#embedList .embed-item');
        items.forEach((item, i) => {
            item.querySelector('.embed-label').textContent = `Opção ${i + 1}`;
        });
    },

    // ==================== GAME CRUD ====================
    handleAddGame(e) {
        e.preventDefault();

        const embeds = [];
        document.querySelectorAll('#embedList .embed-item').forEach(item => {
            const url = item.querySelector('.embed-url').value.trim();
            const name = item.querySelector('.embed-name').value.trim();
            if (url || name) {
                embeds.push({ url, name: name || `Opção ${embeds.length + 1}` });
            }
        });

        const game = {
            league: document.getElementById('gameLeague').value,
            homeTeam: document.getElementById('homeTeam').value.trim(),
            awayTeam: document.getElementById('awayTeam').value.trim(),
            date: document.getElementById('gameDate').value,
            time: document.getElementById('gameTime').value,
            status: document.getElementById('gameStatus').value,
            homeScore: parseInt(document.getElementById('homeScore').value) || 0,
            awayScore: parseInt(document.getElementById('awayScore').value) || 0,
            featured: document.getElementById('gameFeatured').checked,
            embeds,
        };

        // Map league name to tournament ID
        const tournamentMap = {};
        Object.values(CONFIG.TOURNAMENTS).forEach(t => { tournamentMap[t.name] = t.id; });
        game.leagueId = tournamentMap[game.league] || 0;

        GamesDB.add(game);
        showToast('Jogo adicionado com sucesso!', 'success');

        // Reset form
        e.target.reset();
        document.getElementById('embedList').innerHTML = `
            <div class="embed-item">
                <span class="embed-label">Opção 1</span>
                <input type="text" class="embed-url" placeholder="URL do embed (iframe src)">
                <input type="text" class="embed-name" placeholder="Nome (ex: HD, Narração BR)">
                <button type="button" class="embed-remove" title="Remover"><i class="fas fa-trash"></i></button>
            </div>
        `;
        document.getElementById('scoreRow').style.display = 'none';

        if (typeof App !== 'undefined') App.loadAllData();
    },

    refreshManagedGames() {
        const container = document.getElementById('managedGamesList');
        const games = GamesDB.getAll();

        if (games.length === 0) {
            container.innerHTML = '<div class="no-matches"><i class="fas fa-inbox"></i><p>Nenhum jogo cadastrado</p></div>';
            return;
        }

        const statusOrder = { live: 0, scheduled: 1, finished: 2 };
        games.sort((a, b) => (statusOrder[a.status] || 1) - (statusOrder[b.status] || 1));

        container.innerHTML = games.map(game => `
            <div class="managed-game-item" data-id="${game.id}">
                <div class="managed-game-info">
                    <span class="mg-league">${game.league}</span>
                    <div class="mg-teams">
                        ${game.homeTeam}
                        ${game.status !== 'scheduled' ? `<strong>${game.homeScore} x ${game.awayScore}</strong>` : 'vs'}
                        ${game.awayTeam}
                    </div>
                    <span class="mg-time">${this.formatDate(game.date)} às ${game.time}</span>
                    <span class="mg-embeds">${game.embeds.length} link(s) de transmissão</span>
                </div>
                <div class="managed-game-actions">
                    <button class="mg-btn edit" onclick="Admin.editGame('${game.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="mg-btn" onclick="Admin.toggleGameStatus('${game.id}')" title="Alterar Status">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="mg-btn delete" onclick="Admin.deleteGame('${game.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    editGame(id) {
        const game = GamesDB.getById(id);
        if (!game) return;

        document.getElementById('gameLeague').value = game.league;
        document.getElementById('homeTeam').value = game.homeTeam;
        document.getElementById('awayTeam').value = game.awayTeam;
        document.getElementById('gameDate').value = game.date;
        document.getElementById('gameTime').value = game.time;
        document.getElementById('gameStatus').value = game.status;
        document.getElementById('homeScore').value = game.homeScore;
        document.getElementById('awayScore').value = game.awayScore;
        document.getElementById('gameFeatured').checked = game.featured;

        if (game.status !== 'scheduled') {
            document.getElementById('scoreRow').style.display = 'grid';
        }

        const embedList = document.getElementById('embedList');
        embedList.innerHTML = '';
        if (game.embeds && game.embeds.length > 0) {
            game.embeds.forEach((embed, i) => {
                const item = document.createElement('div');
                item.className = 'embed-item';
                item.innerHTML = `
                    <span class="embed-label">Opção ${i + 1}</span>
                    <input type="text" class="embed-url" placeholder="URL do embed" value="${embed.url || ''}">
                    <input type="text" class="embed-name" placeholder="Nome" value="${embed.name || ''}">
                    <button type="button" class="embed-remove" title="Remover"><i class="fas fa-trash"></i></button>
                `;
                item.querySelector('.embed-remove').addEventListener('click', () => {
                    item.remove();
                    this.reorderEmbedLabels();
                });
                embedList.appendChild(item);
            });
        } else {
            this.addEmbedField();
        }

        GamesDB.delete(id);
        this.switchTab('add-game');
        showToast('Editando jogo. Salve para aplicar as alterações.', 'info');
    },

    toggleGameStatus(id) {
        const game = GamesDB.getById(id);
        if (!game) return;

        const cycle = { scheduled: 'live', live: 'finished', finished: 'scheduled' };
        const newStatus = cycle[game.status] || 'scheduled';

        GamesDB.update(id, { status: newStatus });
        this.refreshManagedGames();
        showToast(`Status alterado para: ${newStatus === 'live' ? 'Ao Vivo' : newStatus === 'finished' ? 'Encerrado' : 'Agendado'}`, 'success');

        if (typeof App !== 'undefined') App.loadAllData();
    },

    deleteGame(id) {
        if (confirm('Tem certeza que deseja excluir este jogo?')) {
            GamesDB.delete(id);
            this.refreshManagedGames();
            showToast('Jogo excluído', 'success');
            if (typeof App !== 'undefined') App.loadAllData();
        }
    },

    // ==================== SETTINGS (protected) ====================
    loadSettings() {
        if (!Auth.isLoggedIn()) return;

        const apiKeyEl = document.getElementById('apiKey');
        const refreshEl = document.getElementById('refreshInterval');

        if (apiKeyEl) {
            const apiKey = localStorage.getItem('pdb_api_key') || CONFIG.API_KEY;
            // Mask the API key for display
            apiKeyEl.value = apiKey ? apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 6) : '';
            apiKeyEl.dataset.fullKey = apiKey;
        }
        if (refreshEl) {
            refreshEl.value = localStorage.getItem('pdb_refresh_interval') || '300';
        }
    },

    saveSettings() {
        if (!Auth.isLoggedIn()) {
            showToast('Você precisa estar logado para alterar configurações.', 'error');
            return;
        }

        const apiKeyEl = document.getElementById('apiKey');
        const refreshInterval = document.getElementById('refreshInterval').value;
        const newUsername = document.getElementById('settingsUsername')?.value.trim();
        const currentPass = document.getElementById('settingsCurrentPass')?.value;
        const newPass = document.getElementById('settingsNewPass')?.value;

        // Save API key (only if user typed a new full key, not the masked version)
        const apiKeyVal = apiKeyEl.value.trim();
        if (apiKeyVal && !apiKeyVal.includes('...')) {
            localStorage.setItem('pdb_api_key', apiKeyVal);
            CONFIG.API_KEY = apiKeyVal;
        }

        // Save refresh interval
        if (refreshInterval) {
            localStorage.setItem('pdb_refresh_interval', refreshInterval);
            CONFIG.REFRESH_INTERVAL = parseInt(refreshInterval) * 1000;
        }

        // Change password if provided
        if (currentPass && newPass) {
            if (newPass.length < 6) {
                showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error');
                return;
            }
            if (!Auth.changePassword(currentPass, newPass)) {
                showToast('Senha atual incorreta.', 'error');
                return;
            }
            showToast('Senha alterada com sucesso!', 'success');
            document.getElementById('settingsCurrentPass').value = '';
            document.getElementById('settingsNewPass').value = '';
        }

        // Change username if provided
        if (newUsername && currentPass) {
            Auth.changeUsername(newUsername, currentPass);
        }

        showToast('Configurações salvas!', 'success');
        this.loadSettings();

        if (typeof App !== 'undefined') App.loadAllData();
    },

    // ==================== ARTICLE EDITOR ====================
    apiToken: null,

    async getApiToken() {
        if (this.apiToken) return this.apiToken;
        // Use stored API token from login
        const stored = localStorage.getItem('pdb_api_token');
        if (stored) { this.apiToken = stored; return stored; }
        return null;
    },

    async apiCall(endpoint, method = 'GET', body = null) {
        const token = await this.getApiToken();
        if (!token) { showToast('Faça login novamente', 'error'); this.handleLogout(); this.showLoginModal(); return null; }

        const options = {
            method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);

        try {
            const res = await fetch(`/pdb-api/${endpoint}`, options);

            // If unauthorized, clear token and force re-login
            if (res.status === 401) {
                this.apiToken = null;
                localStorage.removeItem('pdb_api_token');
                showToast('Sessão expirada. Faça login novamente.', 'error');
                this.handleLogout();
                this.showLoginModal();
                return null;
            }

            return await res.json();
        } catch(e) {
            showToast('Erro de conexão com a API', 'error');
            return null;
        }
    },

    async loadArticlesList() {
        const container = document.getElementById('editorArticlesList');
        const countEl = document.getElementById('editorCount');
        if (!container) return;

        const data = await this.apiCall('articles?limit=50');
        if (!data?.articles) {
            container.innerHTML = '<div class="no-matches"><p>Erro ao carregar artigos</p></div>';
            return;
        }

        countEl.textContent = `${data.total} artigos`;

        if (data.articles.length === 0) {
            container.innerHTML = '<div class="no-matches"><i class="fas fa-newspaper"></i><p>Nenhum artigo</p></div>';
            return;
        }

        container.innerHTML = data.articles.map(a => {
            const date = a.pubDate ? new Date(a.pubDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
            return `
                <div class="editor-article-item">
                    <div class="editor-article-thumb">
                        ${a.image ? `<img src="${a.image}" alt="" onerror="this.style.display='none'">` : ''}
                    </div>
                    <div class="editor-article-info">
                        <div class="ea-title">${a.rewrittenTitle || a.originalTitle || ''}</div>
                        <div class="ea-meta">${date} | ${a.source || 'Manual'} | ${a.category || ''}</div>
                    </div>
                    <div class="editor-article-actions">
                        <button class="mg-btn edit" onclick="Admin.editArticle('${a.slug}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="mg-btn delete" onclick="Admin.deleteArticle('${a.slug}')" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    },

    showArticleForm(article = null) {
        document.getElementById('editorList').style.display = 'none';
        document.getElementById('editorForm').style.display = 'block';

        if (article) {
            document.getElementById('editSlug').value = article.slug || '';
            document.getElementById('articleTitle').value = article.rewrittenTitle || '';
            document.getElementById('articleText').value = article.rewrittenText || '';
            document.getElementById('articleImage').value = article.image || '';
            document.getElementById('articleCategory').value = article.category || 'Futebol Brasileiro';
            document.getElementById('articleAuthor').value = article.author || 'Redação Papo de Bola';
        } else {
            document.getElementById('editSlug').value = '';
            document.getElementById('articleTitle').value = '';
            document.getElementById('articleText').value = '';
            document.getElementById('articleImage').value = '';
            document.getElementById('articleCategory').value = 'Futebol Brasileiro';
            document.getElementById('articleAuthor').value = 'Redação Papo de Bola';
        }
    },

    hideArticleForm() {
        document.getElementById('editorList').style.display = 'block';
        document.getElementById('editorForm').style.display = 'none';
        this.loadArticlesList();
    },

    async editArticle(slug) {
        const data = await this.apiCall('articles?limit=50');
        if (!data?.articles) return;
        const article = data.articles.find(a => a.slug === slug);
        if (article) this.showArticleForm(article);
    },

    async saveArticle() {
        const slug = document.getElementById('editSlug').value;
        const title = document.getElementById('articleTitle').value.trim();
        const text = document.getElementById('articleText').value.trim();
        const image = document.getElementById('articleImage').value.trim();
        const category = document.getElementById('articleCategory').value;
        const author = document.getElementById('articleAuthor').value.trim();

        if (!title || !text) {
            showToast('Título e conteúdo são obrigatórios', 'error');
            return;
        }

        let result;
        if (slug) {
            // Edit existing
            result = await this.apiCall(`articles/${slug}`, 'PUT', { title, text, image, category, author });
        } else {
            // Create new
            result = await this.apiCall('articles', 'POST', { title, text, image, category, author });
        }

        if (result?.article || result?.deleted === undefined) {
            showToast(slug ? 'Artigo atualizado!' : 'Artigo publicado!', 'success');
            this.hideArticleForm();
            if (typeof App !== 'undefined') App.loadHomeContent();
        } else {
            showToast('Erro ao salvar: ' + (result?.error || 'desconhecido'), 'error');
        }
    },

    async deleteArticle(slug) {
        if (!confirm('Excluir este artigo permanentemente?')) return;
        const result = await this.apiCall(`articles/${slug}`, 'DELETE');
        if (result?.deleted) {
            showToast('Artigo excluído', 'success');
            this.loadArticlesList();
            if (typeof App !== 'undefined') App.loadHomeContent();
        } else {
            showToast('Erro ao excluir', 'error');
        }
    },

    // ==================== USER MANAGEMENT ====================
    async loadUsersList() {
        const container = document.getElementById('usersList');
        if (!container) return;

        const data = await this.apiCall('users');
        if (!data?.users) {
            container.innerHTML = '<p style="font-size:13px;color:var(--text-muted)">Erro ao carregar usuários</p>';
            return;
        }

        container.innerHTML = data.users.map(u => `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-icon"><i class="fas fa-${u.role === 'admin' ? 'user-shield' : 'user-edit'}"></i></div>
                    <div>
                        <div class="user-name">${u.username}</div>
                        <div class="user-role">${u.role}</div>
                    </div>
                </div>
                <div style="display:flex;gap:4px">
                    <button class="mg-btn edit" onclick="Admin.editUser('${u.username}','${u.role}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="mg-btn" onclick="Admin.resetUserPassword('${u.username}')" title="Resetar Senha"><i class="fas fa-key"></i></button>
                    ${u.username !== 'admin' ? `<button class="mg-btn delete" onclick="Admin.deleteUser('${u.username}')" title="Excluir"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        `).join('');
    },

    async editUser(username, currentRole) {
        const newRole = currentRole === 'admin' ? 'editor' : 'admin';
        if (!confirm(`Alterar ${username} de "${currentRole}" para "${newRole}"?`)) return;

        const result = await this.apiCall(`users/${encodeURIComponent(username)}`, 'PUT', { role: newRole });
        if (result?.message) {
            showToast(`${username} agora é ${newRole}`, 'success');
            this.loadUsersList();
        } else {
            showToast('Erro: ' + (result?.error || 'desconhecido'), 'error');
        }
    },

    async resetUserPassword(username) {
        const newPass = prompt(`Nova senha para "${username}" (mín. 6 caracteres):`);
        if (!newPass) return;
        if (newPass.length < 6) { showToast('Senha deve ter pelo menos 6 caracteres', 'error'); return; }

        const result = await this.apiCall(`users/${encodeURIComponent(username)}`, 'PUT', { password: newPass });
        if (result?.message) {
            showToast(`Senha de ${username} alterada!`, 'success');
        } else {
            showToast('Erro: ' + (result?.error || 'desconhecido'), 'error');
        }
    },

    async deleteUser(username) {
        if (!confirm(`Excluir o usuário "${username}" permanentemente?`)) return;

        const result = await this.apiCall(`users/${encodeURIComponent(username)}`, 'DELETE');
        if (result?.message) {
            showToast(`Usuário ${username} excluído`, 'success');
            this.loadUsersList();
        } else {
            showToast('Erro: ' + (result?.error || 'desconhecido'), 'error');
        }
    },

    async createUser() {
        const username = document.getElementById('newUserUsername').value.trim();
        const password = document.getElementById('newUserPassword').value;
        const role = document.getElementById('newUserRole').value;

        if (!username || !password) {
            showToast('Preencha usuário e senha', 'error');
            return;
        }
        if (password.length < 6) {
            showToast('Senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }

        const result = await this.apiCall('users', 'POST', { username, password, role });
        if (result?.message) {
            showToast(`Usuário "${username}" criado com sucesso!`, 'success');
            document.getElementById('newUserUsername').value = '';
            document.getElementById('newUserPassword').value = '';
            this.loadUsersList();
        } else {
            showToast('Erro: ' + (result?.error || 'desconhecido'), 'error');
        }
    },

    handleLogout() {
        this.apiToken = null;
        localStorage.removeItem('pdb_api_token');
        localStorage.removeItem('pdb_admin_session');
        this.closePanel();
        this.updateAdminVisibility();
        showToast('Logout realizado.', 'info');
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    },
};

/* =====================================================
   TOAST NOTIFICATION SYSTEM
   ===================================================== */
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
