// This file handles login, two-step registration, and the Google login button.
// I split it into sections to keep things organized since there's quite a bit going on here.

document.addEventListener('DOMContentLoaded', () => {

    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnBack = document.getElementById('btn-back');

