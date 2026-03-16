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
                btn.textContent = 'Signing in...';
            }

            console.log("Attempting login for:", email);

            try {
                const user = await DB.login(email, password);

                if (user) {
                    console.log("Login success:", user.role);
                    // Each role goes to a different dashboard
                    if (user.role === 'admin') window.location.href = 'admin-dash.html';
                    else if (user.role === 'owner') window.location.href = 'owner-dash.html';
                    else window.location.href = 'search.html';
                } else {
                    console.warn("Login failed: Invalid credentials");
                    const errorMsg = document.getElementById('error-msg');
                    if (errorMsg) errorMsg.classList.remove('hidden');
                }
            } catch (err) {
                console.error("Login error:", err);
                Alerts.error("Server error. Check if the backend is running.");
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Sign In';
                }
            }
        });
    }

    // SECTION 2 - TWO-STEP REGISTRATION
    // Step 1 lets the user pick their role (client or owner).
    // Step 2 shows the actual form fields. The role gets stored in a hidden input.
    if (registerForm) {
        const selectedRoleInput = document.getElementById('selected-role');
        const btnRoleClient = document.getElementById('btn-role-client');
        const btnRoleOwner = document.getElementById('btn-role-owner');

        const goToStep2 = (role) => {
            selectedRoleInput.value = role;
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            // Update the "Registering as X" label to reflect the chosen role
            const roleLabel = document.getElementById('role-label');
            if (roleLabel) roleLabel.textContent = role === 'owner' ? 'Owner' : 'Driver';
        };

        if (btnRoleClient) btnRoleClient.addEventListener('click', () => goToStep2('client'));
        if (btnRoleOwner) btnRoleOwner.addEventListener('click', () => goToStep2('owner'));

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('reg-password').value;
            const confirmPass = document.getElementById('confirm-password').value;

            if (password !== confirmPass) {
                Alerts.error("Passwords do not match!");
                return;
            }

            // Build the user object to send to the API
            const newUser = {
                name: document.getElementById('name').value,
                email: document.getElementById('reg-email').value.trim(),
                password: password,
                role: selectedRoleInput.value || 'client',
                phone: document.getElementById('reg-phone')?.value || null
            };

            const success = await DB.register(newUser);
            if (success) {
                localStorage.setItem('parkly_terms_accepted', 'true');
                const user = await DB.login(newUser.email, newUser.password);
                if (user) {
                    if (user.role === 'admin') window.location.href = 'admin-dash.html';
                    else if (user.role === 'owner') window.location.href = 'owner-dash.html';
                    else window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'login.html';
                }
            } else {
                Alerts.error("Error: Email already exists.");
            }
        });
    }

    // SECTION 3 - GOOGLE LOGIN BUTTON
    // I just trigger the Google auth flow from google-auth.js.
    // If it's on the register page, I first check that the user accepted the terms.
    const btnGoogleLogin = document.getElementById('btn-google-login');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof window.handleGoogleLogin === 'function') {
                window.handleGoogleLogin();
            }
        });
    }

    // The back button either goes back to step 1 in registration, or returns to login
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (step2 && !step2.classList.contains('hidden')) {
                step2.classList.add('hidden');
                step1.classList.remove('hidden');
            } else {
                window.location.href = 'login.html';
            }
        });
    }
});
