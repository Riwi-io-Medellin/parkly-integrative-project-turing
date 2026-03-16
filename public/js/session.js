// This script runs on the login and register pages.
// If there's already a session saved, I redirect the user to their dashboard
// so they don't have to log in again every time they visit.
const parkly_session = JSON.parse(localStorage.getItem('parkly_session'));
if (!parkly_session) {
    console.log("Login Page");
} else if (parkly_session.role == 'client') {
    window.location.href = './search.html';
} else if (parkly_session.role == 'owner') {
    window.location.href = './owner-dash.html';
