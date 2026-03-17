// This runs on the landing page (index.html).
// If the user is already logged in, I send them straight to their dashboard
// so they never see the landing page again unnecessarily.
const parkly_session = JSON.parse(localStorage.getItem('parkly_session'));
if (!parkly_session) {
    console.log("Landing Page");
} else if (parkly_session.role == 'client') {
    window.location.href = './search.html';
} else if (parkly_session.role == 'admin') {
    window.location.href = './admin-dash.html';
} else if (parkly_session.role == 'owner') {
    window.location.href = './owner-dash.html';
}
