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
        } else {
            navLinkBookings.href = 'dashboard.html';
            icon.setAttribute('data-lucide', 'layout-dashboard');
            navLinkBookings.appendChild(icon);
            navLinkBookings.appendChild(document.createTextNode(' Client Dashboard'));
        }
    }

    // Profile pill dropdown — toggles on click, closes when clicking outside
    const profilePill = document.getElementById('profile-pill');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profilePill && profileDropdown) {
        profilePill.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            profileDropdown.classList.add('hidden');
        });

        profileDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Floating chat button — always navigates to the chat hub
    const floatingChatBtn = document.getElementById('floating-chat-btn');
    if (floatingChatBtn) {
        floatingChatBtn.addEventListener('click', () => {
            window.location.href = 'chat.html';
        });
    }

    if (window.lucide) lucide.createIcons();

    // Terms and Conditions guard — if the user is logged in but hasn't accepted the terms,
    // I block the page with a modal. If they refuse, they get logged out.
    const protectedPages = ['search.html', 'owner-dash.html', 'admin-dash.html', 'profile.html', 'payment.html', 'chat.html', 'booking.html'];
    const currentPage = window.location.pathname.split('/').pop();
    const termsAccepted = localStorage.getItem('parkly_terms_accepted') === 'true';
    const hasSession = !!JSON.parse(localStorage.getItem('parkly_session'));

    if (hasSession && !termsAccepted && protectedPages.includes(currentPage)) {
        document.body.style.overflow = 'hidden';
        Swal.fire({
            title: 'Terms and Conditions',
            html: `
                <p style="font-size:14px; margin-bottom:16px; text-align:left">
                    To continue using Parkly you must accept our Terms and Conditions.
                </p>
                <div style="text-align:left; display:flex; align-items:flex-start; gap:10px; padding:12px; border-radius:10px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2)">
                    <input type="checkbox" id="swal-terms-guard-check" style="margin-top:3px; width:16px; height:16px; cursor:pointer; flex-shrink:0">
                    <label for="swal-terms-guard-check" style="font-size:13px; cursor:pointer; line-height:1.5">
                        I have read and accept the
                        <a href="legalidad.html" target="_blank" style="color:#6366f1; font-weight:600; text-decoration:underline">Parkly Terms and Conditions</a>
                    </label>
                </div>`,
            confirmButtonText: 'Accept and continue',
            cancelButtonText: 'Sign out',
            showCancelButton: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: () => {
                const checked = document.getElementById('swal-terms-guard-check')?.checked;
                if (!checked) {
                    Swal.showValidationMessage('You must check the box to accept the Terms and Conditions.');
                    return false;
                }
                return true;
            }
        }).then((result) => {
            document.body.style.overflow = '';
            if (result.isConfirmed) {
                localStorage.setItem('parkly_terms_accepted', 'true');
            } else {
                // User declined — log them out
                localStorage.removeItem('parkly_session');
                localStorage.removeItem('parkly_terms_accepted');
                window.location.href = 'login.html';
            }
