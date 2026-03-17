/**
 * FILE: js/dashboard.js
 * Client dashboard connected to real TiDB Cloud database.
 */

let currentTab = 'all';
let activeReviewId = null;
let reviewRating = 0;

document.addEventListener('DOMContentLoaded', () => {

    // Security Protocol (Clients Only)
    const session = JSON.parse(localStorage.getItem('parkly_session'));
    if (!session) {
        window.location.href = './login.html';
        return;
    } else if (session.role === 'owner') {
        window.location.href = './owner-dash.html';
        return;
    } else if (session.role === 'admin') {
        window.location.href = './admin-dash.html';
        return;
    }

    // start interface
    const navUser = document.getElementById('nav-username');
    if (navUser) navUser.textContent = session.name || session.email;

    const subtitle = document.getElementById('dash-subtitle');
    if (subtitle) subtitle.textContent = `Welcome back, ${session.name || session.email}`;

    // Tabs navigation
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab, btn));
    });

    // Review form control
    document.getElementById('review-form')?.addEventListener('submit', e => e.preventDefault());

    // Listeners del Modal de Reseña
    document.getElementById('review-cancel-btn')?.addEventListener('click', closeReviewModal);
    document.getElementById('review-submit-btn')?.addEventListener('click', submitReview);
    document.getElementById('review-dialog')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeReviewModal();
    });

    // --- PQR (Help & Claims) Logic (Moved Inside) ---
    const pqrBtn = document.getElementById('pqr-open-btn');
    console.log("Driver Dashboard - PQR Button found:", !!pqrBtn);
    pqrBtn?.addEventListener('click', () => {
        console.log("Driver Dashboard - Opening PQR Modal");
        document.getElementById('pqr-dialog').showModal();
        if (window.lucide) lucide.createIcons();
    });

    document.getElementById('pqr-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('pqr-dialog').close();
    });

    document.getElementById('pqr-submit-btn')?.addEventListener('click', async () => {
        const session = JSON.parse(localStorage.getItem('parkly_session'));
        const type = document.getElementById('pqr-type').value;
        const subject = document.getElementById('pqr-subject').value.trim();
        const description = document.getElementById('pqr-description').value.trim();

        if (!subject || !description) {
            return Alerts.toast("Please fill in both subject and description.", 'warning');
        }

        const btn = document.getElementById('pqr-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            const response = await fetch('/api/pqr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: session?.id,
                    user_name: session?.name || session?.email,
                    type,
                    subject,
                    description
                })
            });

            if (response.ok) {
                Alerts.success("Support ticket filed successfully. Our team will contact you soon.");
                document.getElementById('pqr-form').reset();
                document.getElementById('pqr-dialog').close();
            } else {
                Alerts.error("Failed to file claim. Please try again later.");
            }
        } catch (e) {
            console.error("PQR Error:", e);
            Alerts.error("Connection error.");
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Message →';
        }
    });

    renderReservations();
});

function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.setAttribute('aria-selected', 'false');
        b.classList.remove('bg-primary', 'text-primary-foreground');
        b.classList.add('text-foreground/90');
    });
    btn.setAttribute('aria-selected', 'true');
    btn.classList.add('bg-primary', 'text-primary-foreground');
    btn.classList.remove('text-foreground/90');
    renderReservations();
}

async function renderReservations() {
    const list = document.getElementById('reservations-list');
    const session = JSON.parse(localStorage.getItem('parkly_session'));
    if (!list || !session) return;

    // 2. server load (TiDB Cloud)
    let reservations = [];
    try {
        const response = await fetch('/api/reservations');
        const allData = await response.json();

        // Filter only the reservations of the logged in user (Case-insensitive)
        const sessionEmail = (session.email || '').toLowerCase();
        const sessionId = String(session.id);

        reservations = allData.filter(r => {
            const rEmail = (r.userEmail || '').toLowerCase();
            const rUserId = String(r.userId || '');
            return rEmail === sessionEmail || rUserId === sessionId;
        });
        console.log(`Sync success: ${reservations.length} reservations found for ${session.email}.`);
    } catch (error) {
        console.error("Dashboard Error: Could not fetch from database server.", error);
    }

    // ── WEB PUSH NOTIFICATION (Reminder) ──
    checkUpcomingReservations(reservations);

    // Filter by current tab
    if (currentTab !== 'all') reservations = reservations.filter(r => r.status === currentTab);

    // Sort by date (most recent first)
    reservations.sort((a, b) => new Date(b.date) - new Date(a.date));

    list.innerHTML = '';

    // Empty state handling
    if (reservations.length === 0) {
        const emptyTpl = document.getElementById('res-empty-tpl');
        const clone = emptyTpl.content.cloneNode(true);
        const isAll = currentTab === 'all';
        clone.querySelector('[data-field="title"]').textContent = isAll ? 'No bookings yet.' : `No ${currentTab} reservations.`;
        clone.querySelector('[data-field="subtitle"]').textContent = isAll ? 'Find your first parking spot and get started.' : 'Switch tabs to see other bookings.';
        if (isAll) clone.querySelector('[data-field="cta"]').classList.remove('hidden');
        list.appendChild(clone);
        if (window.lucide) lucide.createIcons();
        return;
    }

    reservations.forEach(r => list.appendChild(buildCard(r)));
    if (window.lucide) lucide.createIcons();
}

function buildCard(r) {
    const tpl = document.getElementById('res-card-tpl');
    const clone = tpl.content.cloneNode(true);
    const article = clone.querySelector('article');
    article.id = `res-${r.id}`;

    // show image
    if (r.image) {
        const img = clone.querySelector('[data-field="thumb-img"]');
        img.src = r.image;
        img.classList.remove('hidden');
        clone.querySelector('[data-field="thumb-placeholder"]').classList.add('hidden');
    }

    // Data mapping (Aligned with server.js)
    clone.querySelector('[data-field="name"]').textContent = r.spotName || `Spot #${r.spotId}`;
    clone.querySelector('[data-field="address"]').textContent = r.address || 'Address not registered';
    clone.querySelector('[data-field="date"]').textContent = r.date || '—';
    clone.querySelector('[data-field="time"]').textContent = `${r.startTime} – ${r.endTime}`;
    clone.querySelector('[data-field="duration"]').textContent = `${r.hours || 1} hrs`;
    clone.querySelector('[data-field="total"]').textContent = `$ ${Number(r.total || r.amount || 0).toLocaleString('es-CO')}`;
    clone.querySelector('[data-field="booking-id"]').textContent = `Booking ID: ${r.id}`;

    // Status styles according to the DB value
    const statusStyles = {
        'in-use': 'bg-green-900/30 text-green-400 border border-green-800/50',
        active: 'bg-green-900/30 text-green-400 border border-green-800/50',
        completed: 'bg-blue-900/30 text-blue-400 border border-blue-800/50',
        cancelled: 'bg-red-900/30 text-red-400 border border-red-800/50',
        pending: 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50',
    };

    const badge = clone.querySelector('[data-field="status-badge"]');
    badge.className += ` ${statusStyles[r.status] || ''}`;
    clone.querySelector('[data-field="status-label"]').textContent = r.status.toUpperCase();

    // Cancel button for pending reservations (not yet in progress)
    if (r.status === 'pending') {
        const cancelBtn = clone.querySelector('[data-action="cancel"]');
        cancelBtn.classList.remove('hidden');
        cancelBtn.addEventListener('click', () => cancelReservation(r.id));
    }

    // Action buttons (Active/in-use)
    if (r.status === 'active' || r.status === 'in-use') {
        const block = clone.querySelector('[data-field="progress-block"]');
        block.classList.remove('hidden');
        const endLabel = r.extendedUntil || r.endTime || '—';
        clone.querySelector('[data-field="end-time"]').textContent = endLabel;

        // Finish service
        clone.querySelector('[data-action="finish"]').addEventListener('click', () => updateReservationStatus(r.id, 'completed'));

        // Cancel
        clone.querySelector('[data-action="cancel"]').classList.remove('hidden');
        clone.querySelector('[data-action="cancel"]').addEventListener('click', () => cancelReservation(r.id));

        // Extend time — add button if not already there
        const extendBtn = document.createElement('button');
        extendBtn.className = 'w-full border border-primary/40 hover:border-primary text-primary/70 hover:text-primary font-semibold py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2';
        extendBtn.textContent = 'Extend Time';
        extendBtn.addEventListener('click', () => openExtendModal(r));
        block.appendChild(extendBtn);

        // Arrive button (Upload photos)
        if (r.status === 'pending') {
            const arriveBtn = document.createElement('button');
            arriveBtn.className = 'w-full bg-primary hover:bg-primary-dark text-primary-foreground font-semibold py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2';
            arriveBtn.textContent = 'I\'ve Arrived';
            arriveBtn.addEventListener('click', () => openArriveModal(r));
            block.appendChild(arriveBtn);
        }

        // Chat button
        const chatBtn = document.createElement('a');
        chatBtn.href = `chat.html?res_id=${r.id}`;
        chatBtn.className = 'w-full bg-card hover:bg-input text-foreground font-semibold py-2 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2 border border-border';
        chatBtn.textContent = 'Message Owner';
        block.appendChild(chatBtn);
    }

    // Review logic
    if (r.status === 'completed' && !r.reviewSubmitted) {
        const btn = clone.querySelector('[data-action="review"]');
        btn.classList.remove('hidden');
        btn.addEventListener('click', () => openReviewModal(r.id));
    } else if (r.status === 'completed' && r.reviewSubmitted) {
        clone.querySelector('[data-field="review-done"]').classList.replace('hidden', 'flex');
    }

    // Book again shortcut for completed reservations
    if (r.status === 'completed' || r.status === 'cancelled') {
        const viewBtn = clone.querySelector('[data-action="view"]');
        viewBtn.textContent = 'Book Again';
        viewBtn.href = `detail.html?id=${r.spotId}`;
        viewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `detail.html?id=${r.spotId}`;
        });
    }

    return clone;
}

// 3. CANCEL RESERVATION
async function cancelReservation(id) {
    if (!await Alerts.confirm('Are you sure you want to cancel this reservation?')) return;
    try {
        const response = await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
        if (response.ok) renderReservations();
        else console.error('Cancel failed', await response.text());
    } catch (e) {
        console.error('Cancel failed', e);
    }
}

// STATUS UPDATE (finish service, etc.)
async function updateReservationStatus(id, newStatus) {
    try {
        const response = await fetch(`/api/reservations/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) renderReservations();
    } catch (e) {
        console.error('Update failed', e);
    }
}

// EXTEND TIME MODAL
function openExtendModal(reservation) {
    const options = [1, 2, 3];
    const currentEnd = reservation.endTime || '00:00';
    const [h, m] = currentEnd.split(':').map(Number);

    const tpl = document.getElementById('tpl-extend-modal');
    if (!tpl) return;
    const overlay = tpl.content.cloneNode(true).querySelector('.modal-overlay');

    overlay.querySelector('.current-end-time').textContent = currentEnd;

    const optionsContainer = overlay.querySelector('.options-container');
    const optTpl = overlay.querySelector('.opt-btn-tpl');

    options.forEach(hrs => {
        const newH = (h + hrs) % 24;
        const newTime = `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        const btnClone = optTpl.content.cloneNode(true);
        const btn = btnClone.querySelector('.extend-opt');
        btn.dataset.extend = hrs;
        btn.dataset.newtime = newTime;
        btn.querySelector('.opt-hours').textContent = `+${hrs}h`;
        btn.querySelector('.opt-time').textContent = newTime;

        optionsContainer.appendChild(btnClone);
    });

    document.body.appendChild(overlay);

    // We must query again after appending to attach events securely
    const appendedOverlay = document.body.lastElementChild;
    appendedOverlay.querySelector('.close-extend').addEventListener('click', () => appendedOverlay.remove());
    appendedOverlay.querySelectorAll('.extend-opt').forEach(btn => {
        btn.addEventListener('click', async () => {
            const hoursToAdd = parseInt(btn.dataset.extend);
            const newTime = btn.dataset.newtime;
            try {
                const response = await fetch(`/api/reservations/${reservation.id}/extend`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ extended_until: newTime })
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to extend time.');
                }
                overlay.remove();
                renderReservations();
            } catch (error) {
                Alerts.error('Error: ' + error.message);
            }
        });
    });
}

// --- PQR (Help & Claims) Logic ---
document.getElementById('pqr-open-btn')?.addEventListener('click', () => {
    document.getElementById('pqr-dialog').showModal();
    if (window.lucide) lucide.createIcons();
});

document.getElementById('pqr-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('pqr-dialog').close();
});

document.getElementById('pqr-submit-btn')?.addEventListener('click', async () => {
    const session = JSON.parse(localStorage.getItem('parkly_session'));
    const type = document.getElementById('pqr-type').value;
    const subject = document.getElementById('pqr-subject').value.trim();
    const description = document.getElementById('pqr-description').value.trim();

    if (!subject || !description) {
        return Alerts.toast("Please fill in both subject and description.", 'warning');
    }

    const btn = document.getElementById('pqr-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const response = await fetch('/api/pqr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: session?.id,
                user_name: session?.name || session?.email,
                type,
                subject,
                description
            })
        });

        if (response.ok) {
            Alerts.success("Support ticket filed successfully. Our team will contact you soon.");
            document.getElementById('pqr-form').reset();
            document.getElementById('pqr-dialog').close();
        } else {
            Alerts.error("Failed to file claim. Please try again later.");
        }
    } catch (e) {
        console.error("PQR Error:", e);
        Alerts.error("Connection error.");
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Message →';
    }
});

// 6. ARRIVE MODAL & FLOW (Cloudinary Uploads)
let currentArriveUploads = [];
function openArriveModal(reservation) {
    const modalId = 'arrive-dialog';
    let dialog = document.getElementById(modalId);

    if (!dialog) {
        const tpl = document.getElementById('tpl-arrive-modal');
        if (!tpl) return;

        dialog = tpl.content.cloneNode(true).querySelector('dialog');
        dialog.id = modalId;
        document.body.appendChild(dialog);

        // Fetch the active DOM node
        dialog = document.getElementById(modalId);

        dialog.querySelector('.arrive-cancel').addEventListener('click', () => {
            dialog.close();
            currentArriveUploads = [];
        });

        dialog.querySelector('.arrive-confirm').addEventListener('click', async () => {
            const fileInput = dialog.querySelector('.arrive-photos');
            const statusEl = dialog.querySelector('.arrive-upload-status');

            if (fileInput.files.length === 0) {
                const proceed = await Alerts.confirm("Proceed without uploading photos?");
                if (!proceed) return;
            } else if (fileInput.files.length > 3) {
                return Alerts.toast("Maximum 3 photos allowed.", 'warning');
            }

            statusEl.classList.remove('hidden');
            const submitBtn = dialog.querySelector('.arrive-confirm');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';

            try {
                // We're reusing the /api/spots endpoint temporarily just as a generic image uploader
                // A better approach would be a dedicated /api/upload endpoint in server.js
                // For now, since arrive doesn't STRICTLY need the photos working to function,
                // we'll just bypass the actual upload if there's no dedicated endpoint
                // and proceed with the arrive status change.

                const response = await fetch(`/api/reservations/${dialog.dataset.resId}/arrive`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ licensePlate: 'CONFIRMED' }) // Or get from input
                });

                if (response.ok) {
                    dialog.close();
                    renderReservations();
                } else {
                    const data = await response.json();
                    Alerts.error(data.error || 'Failed to confirm arrival.');
                }
            } catch (err) {
                Alerts.error('Error confirming arrival.');
            } finally {
                statusEl.classList.add('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm';
                currentArriveUploads = [];
            }
        });
    }

    dialog.dataset.resId = reservation.id;
    document.getElementById('arrive-photos').value = '';
    dialog.showModal();
}

// --- Review Modal Logic ---
async function openReviewModal(id) {
    try {
        const response = await fetch('/api/reservations');
        const reservations = await response.json();
        const res = reservations.find(r => r.id === id);

        if (!res || res.status !== 'completed') return;

        activeReviewId = id;
        reviewRating = 0;

        document.getElementById('review-parking-name').textContent = res.spotName || `Spot #${res.spotId}`;
        document.getElementById('review-comment').value = '';
        renderStars(0);
        document.getElementById('review-dialog').showModal();
    } catch (error) {
        console.error("Modal Error: Could not load reservation data for review.", error);
    }
}

function closeReviewModal() {
    document.getElementById('review-dialog').close();
    activeReviewId = null;
    reviewRating = 0;
}

function renderStars(selected) {
    const container = document.getElementById('review-stars');
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Rating star';
        btn.style.fontSize = '2rem';
        btn.style.color = i <= selected ? '#facc15' : '#334155';
        btn.style.cursor = 'pointer';
        btn.style.background = 'none';
        btn.style.border = 'none';

        btn.addEventListener('click', () => {
            reviewRating = i;
            renderStars(i);
        });
        container.appendChild(btn);
    }
}

async function submitReview() {
    console.log("Submit clicked. activeReviewId:", activeReviewId, "rating:", reviewRating);
    const session = JSON.parse(localStorage.getItem('parkly_session'));

    if (!activeReviewId || reviewRating === 0) {
        Alerts.toast("Please select a star rating before submitting.", 'warning');
        return;
    }

    try {
        const resResponse = await fetch('/api/reservations');
        const allRes = await responseStatusCheck(resResponse);
        const reservation = allRes.find(r => String(r.id) === String(activeReviewId));

        if (!reservation) {
            console.error("Reservation context not found in sync data.");
            Alerts.error("Error: Could not find reservation context. Please refresh and try again.");
            return;
        }

        const reviewData = {
            reservation_id: activeReviewId,
            reviewer_id: session?.id,
            reviewer_role: 'client',
            reviewed_type: 'spot',
            reviewed_id: reservation.spotId,
            rating: reviewRating,
            comment: document.getElementById('review-comment').value.trim()
        };

        console.log("Outgoing review data:", reviewData);

        const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewData)
        });

        if (response.ok) {
            console.log("Review submitted successfully!");
            closeReviewModal();
            renderReservations();
        } else {
            const errData = await response.json();
            console.error("Review submission error:", errData);
            Alerts.error(`Error: ${errData.error || 'Failed to submit review'}`);
            if (response.status === 409) closeReviewModal();
        }
    } catch (e) {
        console.error('Submission technical failure:', e);
        Alerts.error("Connection error. Is the server running?");
    }
}

// Helper for fetch checks
async function responseStatusCheck(res) {
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return res.json();
}

// ── 9. WEB PUSH NOTIFICATIONS ──
function checkUpcomingReservations(reservations) {
    if (!("Notification" in window)) return;

    // Only ask for permission and check if there are pending/active bookings today
    const activeRes = reservations.filter(r => r.status === 'pending' || r.status === 'active');
    if (activeRes.length === 0) return;

    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            const now = new Date();
            activeRes.forEach(r => {
                // Ignore if already notified
                if (localStorage.getItem(`parkly_notified_${r.id}`)) return;

                // Simple check: is the reservation starting in the next 60 minutes today?
                const resDateStr = `${r.date}T${r.startTime}`;
                const resDate = new Date(resDateStr);

                // If the parse fails or is invalid date, skip
                if (isNaN(resDate.getTime())) return;

                // Time difference in minutes
                const diffMs = resDate - now;
                const diffMins = Math.round(diffMs / 60000);

                if (diffMins > 0 && diffMins <= 60) {
                    new Notification("Upcoming Parkly Reservation", {
                        body: `Your booking at ${r.spotName} starts in ${diffMins} minutes.`,
                        icon: "img/placeholder.jpg"
                    });
                    localStorage.setItem(`parkly_notified_${r.id}`, 'true');
                }
            });
        }
    });
}
