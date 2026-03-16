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
