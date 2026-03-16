// This file handles login, two-step registration, and the Google login button.
// I split it into sections to keep things organized since there's quite a bit going on here.

document.addEventListener('DOMContentLoaded', () => {

    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnBack = document.getElementById('btn-back');

    // SECTION 1 - LOGIN
    // I listen for the form submit, call the DB.login() helper, and redirect based on role.
    // The button gets disabled while the request is in-flight to prevent double-clicks.
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button[type="submit"]');
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (btn) {
                btn.disabled = true;
