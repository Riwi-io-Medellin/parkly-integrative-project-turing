// This file handles everything on the profile page.
// I load the user's data from the API, fill in the form fields,
// show their reservation count and favorite spots, and handle all form submissions.

document.addEventListener('DOMContentLoaded', async () => {
    const session = JSON.parse(localStorage.getItem('parkly_session'));
    if (!session) {
        window.location.href = './index.html';
        return;
    }

    await loadUserProfile(session);
    loadFavorites();
    setupListeners(session);
});

// Fetches the latest user data from the API and populates the profile page.
// I always pull from the server instead of relying only on localStorage
// in case the user's data changed from another device.
async function loadUserProfile(session) {
    try {
        const response = await fetch(`/api/users/${session.id}`);
        if (!response.ok) throw new Error('Could not fetch latest user data');
        const user = await response.json();

        localStorage.setItem('parkly_session', JSON.stringify(user));

        document.getElementById('profile-name').textContent = user.name;
        document.getElementById('profile-email').textContent = user.email;

        const roleTranslations = {
            'client': 'Client',
            'owner': 'Owner',
            'admin': 'Admin'
        };
        document.getElementById('profile-role-badge').textContent = roleTranslations[user.role] || user.role;

        document.getElementById('field-name').value = user.name;
        document.getElementById('field-phone').value = user.phone || '';
        document.getElementById('field-email').value = user.email;
        document.getElementById('field-vehicle-type').value = user.vehicle_type || '';
        document.getElementById('field-license-plate').value = user.license_plate || '';

        if (user.avatar_url) {
            const img = document.getElementById('avatar-img');
            img.src = user.avatar_url;
            img.classList.remove('hidden');
            document.getElementById('avatar-initial').classList.add('hidden');
        } else {
            const initial = document.getElementById('avatar-initial');
            initial.textContent = user.name[0].toUpperCase();
            initial.classList.remove('hidden');
            document.getElementById('avatar-img').classList.add('hidden');
        }

        // Load the number of reservations for the stats section
        const allRes = await (await fetch('/api/reservations').catch(() => ({ json: () => [] }))).json();
        const myRes = allRes.filter(r => r.userEmail === user.email);
        document.getElementById('stat-bookings').textContent = myRes.length;

        try {
            const favsRes = await fetch(`/api/users/${user.id}/favorites`);
            const favs = favsRes.ok ? await favsRes.json() : [];
            document.getElementById('stat-favorites').textContent = favs.length;
        } catch (e) { console.error('Error loading favorites count', e); }

    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

// Sets up all the event listeners on the page.
// I put them in a separate function to keep DOMContentLoaded clean.
function setupListeners(session) {
    // Back button goes to the right dashboard depending on the user's role
    document.getElementById('profile-back-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = session.role === 'admin' ? 'admin-dash.html' : (session.role === 'owner' ? 'owner-dash.html' : 'search.html');
    });

    // Save profile form — sends updated name, phone, and vehicle info to the API
    document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('field-name').value;
        const phone = document.getElementById('field-phone').value;
        const vehicle_type = document.getElementById('field-vehicle-type').value;
        const license_plate = document.getElementById('field-license-plate').value;
        const pwd = document.getElementById('field-password').value;
        const pwdConf = document.getElementById('field-password-confirm').value;

        if (pwd && pwd !== pwdConf) {
            const err = document.getElementById('save-error');
            err.textContent = "Passwords do not match.";
            err.classList.remove('hidden');
            return;
        }

        const btn = document.getElementById('btn-save-profile');
        const ogContent = Array.from(btn.childNodes);
        btn.replaceChildren();
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'loader');
        icon.className = 'w-4 h-4 animate-spin';
        btn.appendChild(icon);
        btn.appendChild(document.createTextNode(' Saving...'));
        btn.disabled = true;

        try {
            await fetch(`/api/users/${session.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, vehicle_type, license_plate })
            });

            document.getElementById('save-feedback').classList.remove('hidden');
            document.getElementById('save-error').classList.add('hidden');

            await loadUserProfile(session);

            setTimeout(() => {
                document.getElementById('save-feedback').classList.add('hidden');
            }, 3000);

            if (window.lucide) lucide.createIcons();

        } catch (error) {
            const err = document.getElementById('save-error');
            err.textContent = "Error saving profile. Try again.";
            err.classList.remove('hidden');
        } finally {
            btn.replaceChildren(...ogContent);
            btn.disabled = false;
        }
    });

    // Avatar upload — sends the file to our backend which uploads to Cloudinary
    // and returns the public URL, which then gets saved to the user profile.
    document.getElementById('avatar-file')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const progress = document.getElementById('upload-progress');
        progress.classList.remove('hidden');

        try {
            const formData = new FormData();
            formData.append('image', file);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) throw new Error("Cloudinary upload failed.");

            const uploadData = await uploadRes.json();
            const avatarUrl = uploadData.image;

            const patchRes = await fetch(`/api/users/${session.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar_url: avatarUrl })
            });

            if (!patchRes.ok) throw new Error("Failed to save avatar URL to profile.");

            await loadUserProfile(session);
        } catch (error) {
            console.error("Avatar upload error:", error);
            Alerts.error("Error uploading avatar. Please try again.");
        } finally {
            progress.classList.add('hidden');
        }
    });

    // Delete account — requires the user to type "DELETE" to confirm.
    // I soft-delete by setting status to 'deleted' instead of removing the row.
    document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
        const { value: confirmDelete } = await Swal.fire({
            title: 'Type "DELETE" to confirm',
            text: 'This action is irreversible.',
            icon: 'warning',
            input: 'text',
            color: 'hsl(var(--foreground))',
            background: 'hsl(var(--background))',
            confirmButtonColor: 'hsl(var(--danger))',
            confirmButtonText: 'Delete Account',
            customClass: {
                popup: 'rounded-2xl border border-border shadow-2xl',
                input: 'bg-input border-border text-foreground rounded-xl p-3 mt-4',
                confirmButton: 'rounded-xl font-semibold'
            }
        });
        if (confirmDelete === 'DELETE') {
            try {
                await fetch(`/api/users/${session.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'deleted' })
                });

                localStorage.removeItem('parkly_session');
                Alerts.toast("Account deleted. We're sorry to see you go.", 'warning');
                window.location.href = 'search.html';
            } catch (err) {
                Alerts.error("Error deleting account.");
            }
        }
    });

    // Fix the header logo link for client users so it points to search instead of landing
    const backBtn = document.querySelector('header a[href="index.html"]');
    if (backBtn && session.role === 'client') {
        backBtn.href = 'search.html';
        const backText = backBtn.querySelector('span');
        if (backText) {
            backText.textContent = 'PARK';
            const span = document.createElement('span');
            span.className = 'text-primary';
            span.textContent = 'LY';
            backText.appendChild(span);
        }
    }
}

// Renders the list of favorite parking spots for the current user.
// Each card is clickable and takes you to the spot's detail page.
async function loadFavorites() {
    const list = document.getElementById('favorites-list');
    const noFavs = document.getElementById('no-favs');

    if (!list) return;

    const session = JSON.parse(localStorage.getItem('parkly_session'));
    if (!session) return;

    try {
        const res = await fetch(`/api/users/${session.id}/favorites`);
        const favSpots = res.ok ? await res.json() : [];

        if (favSpots.length === 0) {
            if (noFavs) noFavs.classList.remove('hidden');
            list.innerHTML = '';
            return;
        }

        if (noFavs) noFavs.classList.add('hidden');
        list.innerHTML = '';

        favSpots.forEach(s => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3 p-3 bg-slate-900 border border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer';
            div.onclick = () => window.location.href = `detail.html?id=${s.id}`;

            const imgWrap = document.createElement('div');
            imgWrap.className = 'w-12 h-12 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0';
            const img = document.createElement('img');
            img.src = s.image;
            img.className = 'w-full h-full object-cover';
            imgWrap.appendChild(img);

            const contentWrap = document.createElement('div');
            contentWrap.className = 'flex-1';
            const title = document.createElement('p');
            title.className = 'text-sm font-bold text-white line-clamp-1';
            title.textContent = s.name;
            const subtitle = document.createElement('p');
            subtitle.className = 'text-[10px] text-slate-500 line-clamp-1';
            subtitle.textContent = s.address;
            contentWrap.appendChild(title);
            contentWrap.appendChild(subtitle);

            const chevron = document.createElement('i');
            chevron.setAttribute('data-lucide', 'chevron-right');
            chevron.className = 'w-4 h-4 text-slate-600';

            div.replaceChildren(imgWrap, contentWrap, chevron);
            list.appendChild(div);
        });
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error('Error loading favorites UI', e);
    }
}
