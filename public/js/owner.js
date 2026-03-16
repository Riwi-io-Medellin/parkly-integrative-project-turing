// Owner dashboard ÔÇö handles the spot catalog, publish wizard, reservations, and analytics.
// Route protection runs immediately before DOMContentLoaded so we don't waste time loading the page.

const parkly_session = JSON.parse(localStorage.getItem('parkly_session'));
if (!parkly_session) {
    window.location.href = './login.html';
} else if (parkly_session.role === 'client') {
    window.location.href = './search.html';
} else if (parkly_session.role === 'admin') {
    window.location.href = './admin-dash.html';
}

document.addEventListener('DOMContentLoaded', () => {

    const viewDashboard = document.getElementById('view-dashboard');
    const viewPublish = document.getElementById('view-publish');

