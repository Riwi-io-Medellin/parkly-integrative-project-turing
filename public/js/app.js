// This is a shared script loaded on most pages. It handles things that
// need to work everywhere: theme toggle, navbar session state, logout, and the terms guard.

// I apply the saved theme immediately (before the DOM loads) to avoid a flash of wrong theme
(function () {
    const savedTheme = localStorage.getItem('parkly_theme') || 'dark';
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
})();

document.addEventListener('DOMContentLoaded', () => {

    // Theme toggle — swaps the dark class and saves the preference
    const html = document.documentElement;
    const themeBtn = document.getElementById('theme-toggle');

    const syncThemeUI = () => {
        if (!themeBtn) return;
        const isDark = html.classList.contains('dark');

        themeBtn.replaceChildren();
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        icon.className = isDark ? 'h-5 w-5 text-yellow-400' : 'h-5 w-5 text-foreground opacity-70';

        themeBtn.appendChild(icon);

        if (window.lucide) lucide.createIcons();
    };

    syncThemeUI();

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isNowDark = html.classList.toggle('dark');
            localStorage.setItem('parkly_theme', isNowDark ? 'dark' : 'light');
            syncThemeUI();
        });
    }

    // Navigate to the search page when this button is clicked (used from the landing page)
    const navSearchBtn = document.getElementById('btn-nav-search');
    if (navSearchBtn) {
        navSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = './search.html';
        });
    }

    // Global logout button — asks for confirmation before clearing the session
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (await Alerts.confirm("Are you sure you want to log out?")) {
                localStorage.removeItem('parkly_session');
                window.location.href = './index.html';
            }
        });
    }

    // If the user is already logged in on the landing page (index.html),
    // I swap the "Login" buttons with a "Go to my Panel" button and a logout link.
    const session = JSON.parse(localStorage.getItem('parkly_session'));
    const navActions = document.getElementById('nav-actions');

    if (session && navActions) {
        const existingToggle = navActions.querySelector('#theme-toggle');
        navActions.replaceChildren();

        if (existingToggle) {
            navActions.appendChild(existingToggle);
        } else {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'theme-toggle';
            toggleBtn.setAttribute('aria-label', 'Toggle theme');
            toggleBtn.className = 'p-2 rounded-lg border border-border hover:border-primary/50 transition-colors';
            navActions.appendChild(toggleBtn);
            toggleBtn.addEventListener('click', () => {
                const isNowDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('parkly_theme', isNowDark ? 'dark' : 'light');
                syncThemeUI();
            });
        }

        let dashUrl = './search.html';
        if (session.role === 'owner') dashUrl = './owner-dash.html';
        if (session.role === 'admin') dashUrl = './admin-dash.html';

        const btnPanel = document.createElement('a');
        btnPanel.href = dashUrl;
        btnPanel.className = 'inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary-dark shadow-lg shadow-primary/20';
        btnPanel.textContent = 'Go to my Panel';

        const btnLogoutIndex = document.createElement('button');
        btnLogoutIndex.className = 'text-sm font-medium text-foreground/90 hover:text-danger transition-colors ml-4';
        btnLogoutIndex.textContent = 'Logout';
        btnLogoutIndex.addEventListener('click', async () => {
            if (await Alerts.confirm("Are you sure you want to logout?")) {
                localStorage.removeItem('parkly_session');
                window.location.reload();
            }
        });

        navActions.appendChild(btnPanel);
        navActions.appendChild(btnLogoutIndex);
        syncThemeUI();
    }

    // Login buttons on the landing page — I force navigation instead of relying on href
    // because some browsers were ignoring the click in certain edge cases
    const navLoginBtn = document.getElementById('btn-nav-login');
    const heroLoginBtn = document.getElementById('btn-hero-login');

    const goToLogin = (e) => {
        e.preventDefault();
        window.location.href = './login.html';
    };

    if (navLoginBtn) navLoginBtn.addEventListener('click', goToLogin);
    if (heroLoginBtn) heroLoginBtn.addEventListener('click', goToLogin);

    // Set up the navbar avatar — shows initials by default, or the avatar image if one is saved
    const navAvatarImg = document.getElementById('nav-avatar-img');
    const navAvatarText = document.getElementById('nav-avatar-text');
    const navUsernameEl = document.getElementById('nav-username');

    if (session) {
        if (navUsernameEl) navUsernameEl.textContent = session.name || session.email;

        if (navAvatarText) {
            const initials = (session.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            navAvatarText.textContent = initials;

            const photo = localStorage.getItem(`parkly_avatar_${session.id}`);
            if (photo && navAvatarImg) {
                navAvatarImg.src = photo;
                navAvatarImg.classList.remove('hidden');
                navAvatarText.classList.add('hidden');
            }
        }
    }

    // The "Bookings" nav link changes label and destination based on the user's role
    const navLinkBookings = document.getElementById('nav-link-bookings');
    if (navLinkBookings && session) {
        navLinkBookings.replaceChildren();
        const icon = document.createElement('i');
        icon.className = 'w-4 h-4';

        if (session.role === 'owner') {
            navLinkBookings.href = 'owner-dash.html';
            icon.setAttribute('data-lucide', 'layout-dashboard');
            navLinkBookings.appendChild(icon);
            navLinkBookings.appendChild(document.createTextNode(' Owner Panel'));
        } else if (session.role === 'admin') {
            navLinkBookings.href = 'admin-dash.html';
            icon.setAttribute('data-lucide', 'shield');
            navLinkBookings.appendChild(icon);
            navLinkBookings.appendChild(document.createTextNode(' Admin Panel'));
