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
