// Admin dashboard — full control over users, spots, reservations, analytics, and PQR tickets.
// This file uses the DOM API and HTML templates, no HTML injected as strings.
// Route protection runs immediately so only admins can load this page.

const parkly_session = JSON.parse(localStorage.getItem('parkly_session'));
if (!parkly_session) {
    window.location.href = './login.html';
} else if (parkly_session.role === 'client') {
    window.location.href = './search.html';
} else if (parkly_session.role === 'owner') {
    window.location.href = './owner-dash.html';
}


document.addEventListener('DOMContentLoaded', async () => {

    const tableFilter = document.getElementById('admin-table-filter');
    const tabs = document.getElementById('tabs-container');

    const viewSummary = document.getElementById('view-summary');
    const viewRequests = document.getElementById('view-requests');
    const viewTable = document.getElementById('view-table');

    let activeTab = 'summary';

    // Module-level data — loaded from the API once on startup, then reloaded after mutations
    let users = [];
    let spots = [];
    let reservations = [];
    let requests = [];

    // Fetches all data from the server. Falls back to localStorage if the server is unreachable.
