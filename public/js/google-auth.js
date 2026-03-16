// handles login, two-step registration, and the Google login button

document.addEventListener('DOMContentLoaded', () => {

    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnBack = document.getElementById('btn-back');

    // --- LOGIN ---
    // sends creds to the API, redirects based on role if successful
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
                    if (user.role === 'admin') window.location.href = 'admin-dash.html';
                    else if (user.role === 'owner') window.location.href = 'owner-dash.html';
                    else window.location.href = 'search.html';
                } else {
                    console.warn("Login failed: Invalid credentials");
                    const errorMsg = document.getElementById('error-msg');
                    if(errorMsg) errorMsg.classList.remove('hidden');
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

    // --- REGISTRATION ---
    // step 1: pick a role (client or owner)
    // step 2: fill in the actual form fields
    if (registerForm) {
        const selectedRoleInput = document.getElementById('selected-role');
        const btnRoleClient = document.getElementById('btn-role-client');
        const btnRoleOwner = document.getElementById('btn-role-owner');

        const goToStep2 = (role) => {
            selectedRoleInput.value = role;
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
        };

        if (btnRoleClient) btnRoleClient.addEventListener('click', () => goToStep2('client'));
        if (btnRoleOwner) btnRoleOwner.addEventListener('click', () => goToStep2('owner'));

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const termsCheckbox = document.getElementById('terms-checkbox');
            if (termsCheckbox && !termsCheckbox.checked) {
                Alerts.error("You must accept the Terms and Conditions to continue.");
                return;
            }

            const password = document.getElementById('reg-password').value;
            const confirmPass = document.getElementById('confirm-password').value;

            if (password !== confirmPass) {
                Alerts.error("Passwords do not match!");
                return;
            }

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
                // auto-login after registering so the user doesn't have to type creds again
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

    // --- GOOGLE LOGIN ---
    // on the register page we check terms first, then trigger the Firebase popup
    const btnGoogleLogin = document.getElementById('btn-google-login');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', (e) => {
            e.preventDefault();
            const termsCheckbox = document.getElementById('terms-checkbox');
            if (termsCheckbox && !termsCheckbox.checked) {
                Alerts.error("You must accept the Terms and Conditions to continue.");
                return;
            }
            if (typeof window.handleGoogleLogin === 'function') {
                window.handleGoogleLogin();
            }
        });
    }

    // back button goes to step 1 if we're on step 2, otherwise back to login
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
