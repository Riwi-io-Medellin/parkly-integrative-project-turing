// This file handles everything related to Google Sign-In using Firebase.
// I use Firebase Auth because it handles the OAuth flow for me — I just need to open a popup.
// After Google authenticates the user, I sync their info with our own MySQL database via the API.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

// Firebase project config — these values come from the Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyBQw83KIxHycKVRHHrvsBbve5lx3al-aRQ",
    authDomain: "parkly-web-fecd0.firebaseapp.com",
    projectId: "parkly-web-fecd0",
    storageBucket: "parkly-web-fecd0.firebasestorage.app",
    messagingSenderId: "423865534808",
    appId: "1:423865534808:web:7f32e209c25591282efd2d",
    measurementId: "G-VQTW1EL4F1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Shows a terms modal if the user hasn't accepted them yet.
// On the register page there's a checkbox; on login we use this modal instead.
async function showTermsModal() {
    const termsCheckbox = document.getElementById('terms-checkbox');
    if (termsCheckbox && termsCheckbox.checked) return true;
    if (localStorage.getItem('parkly_terms_accepted') === 'true') return true;

    const result = await Swal.fire({
        title: 'Terms and Conditions',
        html: `
            <p class="text-sm mb-4" style="text-align:left">To continue using Parkly you must accept our Terms and Conditions.</p>
            <div style="text-align:left; display:flex; align-items:flex-start; gap:10px; padding:12px; border-radius:10px; background:rgba(var(--primary-rgb),0.08); border:1px solid rgba(var(--primary-rgb),0.2)">
                <input type="checkbox" id="swal-terms-check" style="margin-top:3px; width:16px; height:16px; accent-color:var(--primary); flex-shrink:0; cursor:pointer">
                <label for="swal-terms-check" style="font-size:13px; cursor:pointer; line-height:1.5">
                    I have read and accept the
                    <a href="legalidad.html" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:underline">Parkly Terms and Conditions</a>
                </label>
            </div>`,
        confirmButtonText: 'Continue',
        cancelButtonText: 'Cancel',
        showCancelButton: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        preConfirm: () => {
            const checked = document.getElementById('swal-terms-check')?.checked;
            if (!checked) {
                Swal.showValidationMessage('You must check the box to accept the Terms and Conditions.');
                return false;
            }
            return true;
        }
    });
    return result.isConfirmed;
}

// Main Google login handler — exposed globally so auth.js can call it from the button click.
window.handleGoogleLogin = async function () {
    try {
        // Check terms acceptance before opening the Google popup
        const termsAccepted = await showTermsModal();
        if (!termsAccepted) return;

        console.log("Starting Google Auth...");

        // Open the Google sign-in popup and get the authenticated user
        const result = await signInWithPopup(auth, provider);
        const googleUser = result.user;

        console.log("Google Auth Success:", googleUser.email);

        // Read the selected role if the user is on the register page
        const roleInput = document.getElementById('selected-role');
        const selectedRole = roleInput && roleInput.value ? roleInput.value : 'client';

        const userData = {
            name: googleUser.displayName,
            email: googleUser.email,
            photo: googleUser.photoURL,
            role: selectedRole
        };

        let userToSave = null;

        const API_URL = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
            ? "http://localhost:3000/api"
            : "/api";

        try {
            // Send Google user data to our backend so it can create or update the user record
            const res = await fetch(`${API_URL}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            if (res.ok) {
                userToSave = await res.json();
            } else {
                throw new Error("Server rejected Google login");
            }
        } catch (err) {
            console.error(err);
            Alerts.error("Google login failed trying to reach the server.");
            return;
        }

        // Save the session and mark terms as accepted
        localStorage.setItem('parkly_session', JSON.stringify(userToSave));
        localStorage.setItem('parkly_terms_accepted', 'true');

        Alerts.success(`Welcome ${userToSave.name}!`);

        // Redirect to the correct dashboard based on their role
        if (userToSave.role === 'owner') {
            window.location.href = 'owner-dash.html';
        } else if (userToSave.role === 'admin') {
            window.location.href = 'admin-dash.html';
        } else {
            window.location.href = 'search.html';
        }

    } catch (error) {
        console.error("Google Auth Error:", error);
        Alerts.error("Authentication failed: " + error.message);
    }
}
