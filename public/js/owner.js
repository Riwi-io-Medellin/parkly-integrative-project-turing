// Owner dashboard ÔÇö handles the spot catalog, publish wizard, reservations, and analytics.
// Route protection runs immediately before DOMContentLoaded so we don't waste time loading the page.

const parkly_session = JSON.parse(localStorage.getItem('parkly_session'));
if (!parkly_session) {
    window.location.href = './login.html';
} else if (parkly_session.role === 'client') {
    window.location.href = './search.html';
} else if (parkly_session.role === 'admin') {
    window.location.href = './admin-dash.html';
}

document.addEventListener('DOMContentLoaded', () => {

    const viewDashboard = document.getElementById('view-dashboard');
    const viewPublish = document.getElementById('view-publish');

    let currentStep = 1;
    let editingSpotId = null;
    let wizardData = {
        type: '',
        schedule: '24h',
        days: [],
        features: [],
        certFile: null,
        vehicleTypes: [],
        maxWidth: '',
        maxLength: '',
        maxHeight: '',
        photos: [],
        existingPhotos: [],
        mainIdx: 0
    };

    // On load, check if the owner already has spots in the DB.
    // If they do, show the dashboard; if not, show the publish wizard.
    async function checkExistingSpots() {
        const user = JSON.parse(localStorage.getItem('parkly_session'));
        if (!user) return;
        try {
            const res = await fetch(`/api/users/${user.id}/spots`);
            if (res.ok) {
                const spots = await res.json();
                if (spots.length > 0) {
                    toggleView(true);
                    return;
                }
            }
        } catch (e) {
            console.error("Error checking existing spots", e);
        }
        toggleView(false);
    }

    checkExistingSpots();

    // Switches between the main dashboard view and the publish wizard
    function toggleView(showDashboard) {
        if (!viewDashboard || !viewPublish) return;
        if (showDashboard) {
            viewDashboard.classList.remove('hidden');
            viewPublish.classList.add('hidden');
            renderTab();
        } else {
            viewDashboard.classList.add('hidden');
            viewPublish.classList.remove('hidden');
        }
        window.scrollTo(0, 0);
    }

    // Validates the current wizard step before moving forward
    function handleNextStep(e) {
        if (e) e.preventDefault();

        if (currentStep === 1) {
            if (!wizardData.type) return Alerts.toast("Please select a property type.", 'warning');
            const cap = document.getElementById('wiz-capacity').value;
            if (!cap || parseInt(cap) < 1) return Alerts.toast("Please enter the number of available spots (at least 1).", 'warning');
        }
        if (currentStep === 2) {
            if (!document.getElementById('wiz-address').value.trim()) return Alerts.toast("Please enter the spot address.", 'warning');
            if (!wizardData.schedule) return Alerts.toast("Please select an availability schedule.", 'warning');
            if (wizardData.schedule === 'custom') {
                const activeDays = document.querySelectorAll('.custom-day-check:checked');
                if (activeDays.length === 0) return Alerts.toast("Please enable at least one day in your custom schedule.", 'warning');
                let timesValid = true;
                activeDays.forEach(cb => {
                    const day = cb.dataset.day;
                    const open = document.querySelector(`.day-open[data-day="${day}"]`).value;
                    const close = document.querySelector(`.day-close[data-day="${day}"]`).value;
                    if (!open || !close || open >= close) timesValid = false;
                });
                if (!timesValid) return Alerts.error("Please set valid open and close times for each enabled day (close must be after open).");
            }
        }
        if (currentStep === 3) {
            if (!document.getElementById('wiz-price').value || parseInt(document.getElementById('wiz-price').value) < 1) return Alerts.toast("Please set a price per hour.", 'warning');
            const vTypes = document.querySelectorAll('input[name="wiz-vehicle-type"]:checked');
            if (vTypes.length === 0) return Alerts.toast("Please select at least one vehicle type accepted.", 'warning');
            if (!wizardData.certFile) return Alerts.toast("Please upload the ownership certificate (PDF or photo).", 'warning');
            if (wizardData.photos.length === 0) return Alerts.toast("Please add at least one photo of your parking spot.", 'warning');
        }

        if (currentStep < 4) {
            document.getElementById(`step-${currentStep}`).classList.add('hidden');
            currentStep++;
            document.getElementById(`step-${currentStep}`).classList.remove('hidden');
            updateIndicators();

            if (currentStep === 4) {
                document.getElementById('wiz-nav').classList.add('hidden');
                saveSpot();
            }
        }
    }

    function handlePrevStep(e) {
        if (e) e.preventDefault();

        if (currentStep > 1) {
            document.getElementById(`step-${currentStep}`).classList.add('hidden');
            currentStep--;
            document.getElementById(`step-${currentStep}`).classList.remove('hidden');
            updateIndicators();
        } else {
            toggleView(true);
        }
    }

    // Updates the step indicator dots (active, completed, upcoming)
    function updateIndicators() {
        document.querySelectorAll('.step-dot').forEach((dot, idx) => {
            const stepNum = idx + 1;
            dot.classList.remove('bg-primary', 'text-white', 'border-primary', 'bg-green-500');
            dot.innerText = stepNum;

            if (stepNum === currentStep) {
                dot.classList.add('bg-primary', 'text-primary-foreground', 'border-primary');
            } else if (stepNum < currentStep) {
                dot.classList.add('bg-green-500', 'text-white', 'border-green-500');
                dot.innerText = 'Ô£ô';
            } else {
                dot.classList.add('bg-card', 'text-foreground/90');
            }
        });
    }

    // Opens the owner rating modal so the owner can rate the driver after a service ends
    function openOwnerReviewModal(reservation) {
        const modalId = 'owner-review-dialog';
        let dialog = document.getElementById(modalId);

        if (!dialog) {
            const tpl = document.getElementById('tpl-owner-review-modal');
            if (!tpl) return;
            dialog = tpl.content.cloneNode(true).querySelector('dialog');
            dialog.id = modalId;
            document.body.appendChild(dialog);

            dialog = document.getElementById(modalId);

            let rating = 0;
            const stars = dialog.querySelectorAll('.star-btn');
            stars.forEach(s => {
                s.addEventListener('click', () => {
                    rating = parseInt(s.dataset.val);
                    stars.forEach(st => {
                        parseInt(st.dataset.val) <= rating ?
                            st.classList.replace('text-foreground/90', 'text-yellow-400') :
                            st.classList.replace('text-yellow-400', 'text-foreground/90');
                    });
                });
            });

            const finishWithoutReview = async () => {
                await fetch(`/api/reservations/${dialog.dataset.resId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'completed' })
                });
                dialog.close();
                renderTab();
            };

            dialog.querySelector('.owner-review-skip').addEventListener('click', finishWithoutReview);

            dialog.querySelector('.owner-review-submit').addEventListener('click', async () => {
                if (rating === 0) return Alerts.toast("Please select a star rating or click Skip.", 'warning');

                const comment = dialog.querySelector('.owner-review-text').value;
                const user = JSON.parse(localStorage.getItem('parkly_session'));

                try {
                    await fetch('/api/reviews', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reservation_id: dialog.dataset.resId,
                            reviewer_id: user.id,
                            reviewer_role: 'owner',
                            reviewed_type: 'driver',
                            reviewed_id: reservation?.spotId,
                            rating: rating,
                            comment: comment
                        })
                    });
                    await finishWithoutReview();
                } catch (e) {
                    Alerts.error("Error submitting review.");
                }
            });
        }

        dialog.dataset.resId = reservation.id;
        dialog.dataset.driverId = reservation.userId;

        dialog.querySelectorAll('.star-btn').forEach(s => s.classList.replace('text-yellow-400', 'text-foreground/90'));
        dialog.querySelector('.owner-review-text').value = '';

        dialog.showModal();
    }

    // Collects all wizard form data and sends it to the API via multipart/form-data.
    // Handles both creating a new spot (POST) and editing an existing one (PUT).
    async function saveSpot() {
        const user = JSON.parse(localStorage.getItem('parkly_session'));
        const features = [];
        document.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => features.push(cb.value));

        wizardData.maxWidth = document.getElementById('wiz-max-width')?.value || '';
        wizardData.maxLength = document.getElementById('wiz-max-length')?.value || '';
        wizardData.maxHeight = document.getElementById('wiz-max-height')?.value || '';
        const vehicleTypeChecks = document.querySelectorAll('input[name="wiz-vehicle-type"]:checked');
        wizardData.vehicleTypes = Array.from(vehicleTypeChecks).map(c => c.value);

        const formData = new FormData();
        formData.append('ownerId', user ? user.id : '0');
        formData.append('name', `${wizardData.type} at ${document.getElementById('wiz-address').value.split(',')[0]}`);
        formData.append('address', document.getElementById('wiz-address').value);
        formData.append('price', parseInt(document.getElementById('wiz-price').value) || 5000);
        formData.append('cells', parseInt(document.getElementById('wiz-capacity').value) || 1);

        // For custom schedules I serialize per-day times as JSON
        let scheduleValue = wizardData.schedule;
        if (wizardData.schedule === 'custom') {
            const customData = {};
            document.querySelectorAll('.custom-day-check:checked').forEach(cb => {
                const day = cb.dataset.day;
                const open = document.querySelector(`.day-open[data-day="${day}"]`).value;
                const close = document.querySelector(`.day-close[data-day="${day}"]`).value;
                customData[day] = { open, close };
            });
            scheduleValue = 'custom:' + JSON.stringify(customData);
        }
        formData.append('schedule', scheduleValue);
        formData.append('features', features.join(','));
        formData.append('vehicle_types', wizardData.vehicleTypes.join(','));
        formData.append('max_width', wizardData.maxWidth);
        formData.append('max_length', wizardData.maxLength);
        formData.append('max_height', wizardData.maxHeight);
        formData.append('mainImageIndex', wizardData.mainIdx);

        if (editingSpotId) {
            formData.append('existingImages', JSON.stringify(wizardData.existingPhotos));
        }

        if (wizardData.photos && wizardData.photos.length > 0) {
            wizardData.photos.forEach(file => {
                formData.append('images', file);
            });
        }

        const step4 = document.getElementById('step-4');
        const btnFinish = document.getElementById('btn-finish-wizard');

        if (step4) {
            const h2 = step4.querySelector('h2');
            const p = step4.querySelector('p');
            if (h2) h2.textContent = 'Sending request...';
            if (p) p.textContent = 'Please wait while we save your spot.';
        }
        if (btnFinish) btnFinish.disabled = true;

        try {
            const url = editingSpotId ? `/api/spots/${editingSpotId}` : '/api/spots';
            const method = editingSpotId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                console.log(editingSpotId ? 'Spot updated' : 'Spot saved', data.id);
                if (step4) {
                    const h2 = step4.querySelector('h2');
                    const ps = step4.querySelectorAll('p');
                    if (h2) h2.textContent = editingSpotId ? 'Spot Updated!' : 'Request Sent!';
                    if (ps[0]) ps[0].textContent = editingSpotId
                        ? 'Your spot has been updated successfully.'
                        : 'Your spot has been submitted for review.';
                    if (ps[1]) ps[1].textContent = editingSpotId
                        ? 'Changes are now live.'
                        : 'An admin will verify and approve your spot before it goes live.';
                }
                if (btnFinish) btnFinish.disabled = false;
            } else {
                console.error('Failed to save spot to DB');
                if (btnFinish) btnFinish.disabled = false;
                Alerts.error("Error saving spot to database. Please try again.");
            }
        } catch (err) {
            console.error('Error saving spot:', err);
            if (btnFinish) btnFinish.disabled = false;
            Alerts.error("Connection error while saving spot. Please try again.");
        }
    }

    // Resets all wizard fields and state back to defaults
    function resetWizard() {
        currentStep = 1;
        editingSpotId = null;
        document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
        document.getElementById('step-1').classList.remove('hidden');
        document.getElementById('wiz-nav').classList.remove('hidden');
        updateIndicators();
        document.getElementById('wizard-form').reset();

        const titleEl = document.querySelector('#view-publish h2');
        if (titleEl) titleEl.innerText = "Publish a new spot";

        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('border-primary', 'bg-primary/10'));
        const fLabel = document.getElementById('cert-file-label');
        if (fLabel) fLabel.innerText = "Click to upload PDF or Photo";

        const photosPreview = document.getElementById('photos-preview-container');
        if (photosPreview) {
            photosPreview.innerHTML = '';
            photosPreview.classList.add('hidden');
        }
        document.getElementById('main-photo-hint')?.classList.add('hidden');
        document.getElementById('photos-label').innerText = "Select multiple photos of your spot";

        wizardData = {
            type: '',
            schedule: '24h',
            days: [],
            features: [],
            certFile: null,
            vehicleTypes: [],
            maxWidth: '',
            maxLength: '',
            maxHeight: '',
            photos: [],
            existingPhotos: [],
            mainIdx: 0
        };
    }

    // Checks localStorage for pending notifications (approved/rejected spot requests) and renders them
    function renderOwnerNotifications() {
        const notifContainer = document.getElementById('owner-notifications');
        const tpl = document.getElementById('tpl-owner-notif');
        if (!notifContainer || !tpl) return;

        const user = JSON.parse(localStorage.getItem('parkly_session'));
        if (!user) return;

        const notifications = JSON.parse(localStorage.getItem('parkly_owner_notifications')) || [];
        const myNotifs = notifications.filter(n => (n.ownerId == user.id || n.ownerId === user.email) && !n.dismissed);

        notifContainer.innerHTML = '';

        myNotifs.forEach(n => {
            const clone = tpl.content.cloneNode(true);
            const card = clone.querySelector('.notif-card');
            const iconBox = clone.querySelector('.notif-icon-box');
            const icon = clone.querySelector('.notif-icon');

            if (n.type === 'rejected') {
                card.classList.add('bg-red-900/20', 'border-red-800/50');
                iconBox.classList.add('bg-red-500/20', 'text-red-400');
                icon.setAttribute('data-lucide', 'x-circle');
                clone.querySelector('.notif-title').classList.add('text-red-300');
                clone.querySelector('.notif-title').textContent = 'Spot Request Rejected';
            } else {
                card.classList.add('bg-green-900/20', 'border-green-800/50');
                iconBox.classList.add('bg-green-500/20', 'text-green-400');
                icon.setAttribute('data-lucide', 'check-circle');
                clone.querySelector('.notif-title').classList.add('text-green-300');
                clone.querySelector('.notif-title').textContent = 'Spot Approved!';
            }

            clone.querySelector('.notif-spot-name').textContent = n.spotName;
            clone.querySelector('.notif-msg-text').textContent = n.message;

            if (n.reason) {
                clone.querySelector('.notif-reason-box').classList.remove('hidden');
                clone.querySelector('.notif-reason-text').textContent = n.reason;
            }

            clone.querySelector('.btn-dismiss').addEventListener('click', () => {
                const allNotifs = JSON.parse(localStorage.getItem('parkly_owner_notifications')) || [];
                const idx = allNotifs.findIndex(item => item.id === n.id);
                if (idx !== -1) {
                    allNotifs[idx].dismissed = true;
                    localStorage.setItem('parkly_owner_notifications', JSON.stringify(allNotifs));
                }
                renderOwnerNotifications();
            });

            notifContainer.appendChild(clone);
        });

        if (window.lucide) lucide.createIcons();
    }

    // Fetches the owner's spots and renders the spot card list with earnings stats
    async function renderTab() {
        const user = JSON.parse(localStorage.getItem('parkly_session'));
        const content = document.getElementById('owner-tab-content');
        const countEl = document.getElementById('stat-spots-count');
        const earningsEl = document.getElementById('stat-total-earnings');
        const tplSpot = document.getElementById('tpl-owner-spot');
        const tplEmpty = document.getElementById('tpl-empty-spots');

        if (!content || !tplSpot || !tplEmpty) return;

        let mySpots = [];
        try {
            const res = await fetch(`/api/users/${user.id}/spots`);
            if (res.ok) mySpots = await res.json();
        } catch (e) {
            console.error("Error fetching spots in owner dashboard:", e);
        }

        // Calculate real earnings by summing completed reservations for my spots
        let totalEarnings = 0;
        try {
            const resData = await fetch('/api/reservations');
            if (resData.ok) {
                const allReservations = await resData.json();
                const mySpotIds = mySpots.map(s => Number(s.id));
                const completedRes = allReservations.filter(r =>
                    mySpotIds.includes(Number(r.spotId)) &&
                    r.status?.toLowerCase() === 'completed'
                );
                totalEarnings = completedRes.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
                console.log("Calculated Earnings:", { mySpotIds, count: completedRes.length, total: totalEarnings });
            }
        } catch (e) { console.error("Error calculating earnings:", e); }

        if (countEl) countEl.innerText = mySpots.length;
        if (earningsEl) {
            earningsEl.innerText = `$ ${totalEarnings.toLocaleString('es-CO')}`;
        }

        renderOwnerNotifications();
        content.innerHTML = '';

        const allItems = [
            ...mySpots.map(s => ({ ...s, _type: 'spot' }))
        ];

        if (allItems.length === 0) {
            content.appendChild(tplEmpty.content.cloneNode(true));
            return;
        }

        allItems.forEach(item => {
            const clone = tplSpot.content.cloneNode(true);

            clone.querySelector('.spot-img').src = item.image || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600';
            clone.querySelector('.spot-name').textContent = item.name;
            clone.querySelector('.spot-address').textContent = item.address;
            clone.querySelector('.spot-price').textContent = item.price.toLocaleString('es-CO');

            const featContainer = clone.querySelector('.spot-features');
            if (item.features) {
                const featArray = Array.isArray(item.features) ? item.features : item.features.split(',');
                featArray.forEach(f => {
                    if (!f.trim()) return;
                    const span = document.createElement('span');
                    span.className = 'px-2 py-1 bg-card rounded text-[10px] text-foreground/90';
                    span.textContent = f.trim();
                    featContainer.appendChild(span);
                });
            }

            const badgeContainer = clone.querySelector('.spot-badge-container');
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'inline-flex items-center gap-1 px-3 py-1 text-[10px] font-black rounded-lg';

            if (item.available === 0 || item.available === '0') {
                badgeSpan.classList.add('bg-yellow-900/30', 'text-yellow-400');
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', 'clock');
                icon.className = 'w-3 h-3';
                badgeSpan.appendChild(icon);
                badgeSpan.appendChild(document.createTextNode(' PENDING REVIEW'));
            } else if (item.available === -1 || item.available === '-1') {
                badgeSpan.classList.add('bg-red-900/30', 'text-red-400');
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', 'x-circle');
                icon.className = 'w-3 h-3';
                badgeSpan.appendChild(icon);
                badgeSpan.appendChild(document.createTextNode(' REJECTED'));
            } else {
                badgeSpan.classList.add('bg-green-900/30', 'text-green-400');
                badgeSpan.textContent = 'ACTIVE';
            }
            badgeContainer.innerHTML = '';
            badgeContainer.appendChild(badgeSpan);

            if (item.status === 'active' || item.status === 'in-use' || item.status === 'pending') {
                const finishButton = clone.querySelector('.btn-finish');
                const btnBox = finishButton?.parentElement;

                if (finishButton && (item.status === 'active' || item.status === 'in-use')) {
                    finishButton.classList.remove('hidden');
                    finishButton.addEventListener('click', () => {
                        openOwnerReviewModal(item);
                    });
                }

                if (btnBox && item._type === 'request') {
                    const chatBtn = document.createElement('a');
                    chatBtn.href = `chat.html?res_id=${item.id}`;
                    chatBtn.className = 'flex-1 bg-card hover:bg-input text-foreground font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1 mt-2 border border-border';
                    chatBtn.textContent = 'Message Driver';
                    btnBox.appendChild(chatBtn);
                }
            }

            clone.querySelector('.btn-edit-spot').addEventListener('click', (e) => {
                e.stopPropagation();
                editSpot(item);
            });

            content.appendChild(clone);
        });

        renderArrivals(user);
        if (window.lucide) lucide.createIcons();
    }

    // Shows today's pending arrivals so the owner can confirm when a driver shows up
    async function renderArrivals(user) {
        const container = document.getElementById('arrivals-container');
        if (!container || !user) return;
        try {
            const res = await fetch('/api/reservations');
            if (!res.ok) return;
            const all = await res.json();
            const today = new Date().toISOString().split('T')[0];
            const mySpots = JSON.parse(localStorage.getItem('parkly_spots')) || [];
            const mySpotIds = mySpots.filter(s => s.ownerId == user.id || s.owner_id == user.id || s.ownerId === user.email).map(s => s.id);
            const arrivals = all.filter(r =>
                r.status === 'pending' &&
                r.date === today &&
                mySpotIds.includes(r.spotId)
            );
            container.innerHTML = '';
            if (arrivals.length === 0) {
                const emptyP = document.createElement('p');
                emptyP.className = 'text-xs text-foreground/90 italic';
                emptyP.textContent = 'No pending arrivals for today.';
                container.appendChild(emptyP);
                return;
            }
            arrivals.forEach(r => {
                const tpl = document.getElementById('tpl-owner-arrival-card');
                if (!tpl) return;
                const clone = tpl.content.cloneNode(true);
                const card = clone.querySelector('.arrival-card');

                clone.querySelector('.arrival-user').textContent = r.userName || r.userEmail;
                clone.querySelector('.arrival-details').textContent = `${r.spotName} ┬À ${r.startTime} - ${r.endTime}`;

                const btn = clone.querySelector('.btn-confirm-arrival');
                btn.dataset.resId = r.id;

                btn.addEventListener('click', async (e) => {
                    const resId = e.currentTarget.dataset.resId;
                    await fetch(`/api/reservations/${resId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'in-use' })
                    });
                    card.remove();
                    if (!container.querySelector('.arrival-card')) {
                        const emptyP = document.createElement('p');
                        emptyP.className = 'text-xs text-slate-500 italic';
                        emptyP.textContent = 'All arrivals confirmed!';
                        container.appendChild(emptyP);
                    }
                });
                container.appendChild(clone);
            });
        } catch (e) { console.warn('Could not load arrivals', e); }
        if (window.lucide) lucide.createIcons();
    }

    // Renders the analytics tab with a usage heatmap and per-spot earnings breakdown.
    // Also fires optional async requests to a Python stats service if it's running.
    let ownerChartsInit = false;
    async function renderOwnerAnalytics() {
        if (ownerChartsInit) return;
        ownerChartsInit = true;
        const user = JSON.parse(localStorage.getItem('parkly_session'));
        if (!user) return;

        const content = document.getElementById('owner-tab-content');
        if (!content) return;
        console.log("Rendering owner analytics...");

        const tpl = document.getElementById('tpl-owner-analytics');
        if (!tpl) return;
        content.innerHTML = '';
        content.appendChild(tpl.content.cloneNode(true));

        if (window.lucide) lucide.createIcons();

        const hours = Array.from({ length: 24 }, (_, i) => i);
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        const heatmapHeader = document.querySelector('.heatmap-header');
        if (heatmapHeader) {
            hours.forEach(h => {
                const hourDiv = document.createElement('div');
                hourDiv.textContent = `${h}h`;
                heatmapHeader.appendChild(hourDiv);
            });
        }

        const heatmapBody = document.querySelector('.heatmap-body');
        if (heatmapBody) {
            days.forEach((day, dIdx) => {
                const row = document.createElement('div');
                row.className = 'grid grid-cols-[50px_repeat(24,minmax(20px,1fr))] gap-1 mb-1 items-center';

                const dayLabel = document.createElement('div');
                dayLabel.className = 'text-[10px] text-slate-400 font-bold';
                dayLabel.textContent = day;
                row.appendChild(dayLabel);

                hours.forEach(hour => {
                    let intensity = (dIdx < 5 && ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 19))) ? 3 : (Math.random() > 0.7 ? 1 : 0);
                    let bgClass = ['bg-slate-800/50', 'bg-blue-900/40', 'bg-blue-600/60', 'bg-blue-500'][intensity] || 'bg-slate-800/50';

                    const cell = document.createElement('div');
                    cell.className = `h-6 rounded-sm ${bgClass} cursor-help transition-all hover:ring-2 hover:ring-white`;
                    cell.title = `${day} ${hour}:00`;
                    row.appendChild(cell);
                });
                heatmapBody.appendChild(row);
            });
        }

        // Fetch real earnings data for each spot
        try {
            const [respSpots, respRes] = await Promise.all([fetch(`/api/users/${user.id}/spots`), fetch('/api/reservations')]);
            if (respSpots.ok && respRes.ok) {
                const mySpots = await respSpots.json();
                const allRes = await respRes.json();
                const earnsContainer = document.querySelector('.earnings-list-container');
                if (earnsContainer) {
                    if (mySpots.length > 0) {
                        earnsContainer.innerHTML = '';
                        const earnTpl = document.getElementById('tpl-earnings-item');

                        mySpots.forEach(spot => {
                            const spotRes = allRes.filter(r => Number(r.spotId) === Number(spot.id) && r.status.toLowerCase() === 'completed');
                            const spotTotal = spotRes.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

                            const clone = earnTpl.content.cloneNode(true);
                            clone.querySelector('.spot-name').textContent = spot.name;
                            clone.querySelector('.spot-bookings').textContent = `${spotRes.length} bookings completed`;
                            clone.querySelector('.spot-total').textContent = `$${spotTotal.toLocaleString('es-CO')}`;

                            earnsContainer.appendChild(clone);
                        });
                    } else {
                        earnsContainer.textContent = 'No spots found to breakdown.';
                        earnsContainer.className = 'text-slate-500 text-xs text-center py-4 italic';
                    }
                }
            }
        } catch (e) { console.error("Earnings fetch failed", e); }

        // Try to load data from the optional Python stats microservice
        const pythonBase = "http://localhost:8000/api/python/stats";

        fetch(`${pythonBase}/occupancy-rate`)
            .then(r => r.ok ? r.json() : null)
            .then(occ => {
                const occVal = document.getElementById('occupancy-val');
                const ring = document.getElementById('occupancy-ring');
                if (occVal && ring) {
                    const rate = occ?.occupancy_rate || 0;
                    occVal.innerText = `${rate}%`;
                    if (rate > 0) {
                        ring.style.borderTopColor = '#10b981';
                        if (rate > 25) ring.style.borderRightColor = '#10b981';
                        if (rate > 50) ring.style.borderBottomColor = '#10b981';
                        if (rate > 75) ring.style.borderLeftColor = '#10b981';
                    }
                }
            }).catch(e => console.warn("Occupancy fetch error", e));

        fetch(`${pythonBase}/monthly-projection`)
            .then(r => r.ok ? r.json() : null)
            .then(proj => {
                const loader = document.getElementById('revenue-chart-loader');
                if (loader) loader.classList.add('hidden');

                const canvasEl = document.getElementById('owner-chart-revenue');
                if (canvasEl && proj) {
                    new Chart(canvasEl.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                            datasets: [{ label: 'Projection', data: Array(12).fill(Math.round(proj.projection / 12)), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b' } }, y: { ticks: { color: '#64748b' } } } }
                    });
                }
            }).catch(e => {
                const loader = document.getElementById('revenue-chart-loader');
                if (loader) {
                    loader.textContent = 'Service Unavailable';
                    loader.className = 'text-red-500 text-[10px] text-center pt-8';
                }
                console.warn("Projection fetch error", e);
            });
    }

    // Renders all reservations for the owner's spots, grouped into Active and History sections
    async function renderReservationsTab() {
        const user = JSON.parse(localStorage.getItem('parkly_session'));
        const content = document.getElementById('owner-tab-content');
        const tplRes = document.getElementById('tpl-owner-reservation');
        const tplEmpty = document.getElementById('tpl-empty-reservations');

        if (!content || !tplRes || !tplEmpty || !user) return;
        const spinnerContainer = document.createElement('div');
        spinnerContainer.className = 'flex items-center justify-center p-12';
        const spinner = document.createElement('div');
        spinner.className = 'w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin';
        spinnerContainer.appendChild(spinner);
        content.replaceChildren(spinnerContainer);

        try {
            const spotsRes = await fetch(`/api/users/${user.id}/spots`);
            const mySpots = await spotsRes.json();
            const mySpotIds = mySpots.map(s => s.id);

            const resResponse = await fetch('/api/reservations');
            const allRes = await resResponse.json();

            const myReservations = allRes.filter(r => mySpotIds.includes(r.spotId));

            content.innerHTML = '';
            if (myReservations.length === 0) {
                content.appendChild(tplEmpty.content.cloneNode(true));
                if (window.lucide) lucide.createIcons();
                return;
            }

            const active = myReservations.filter(r => ['pending', 'in-use'].includes(r.status));
            const completed = myReservations.filter(r => ['completed', 'cancelled'].includes(r.status));

            const renderSection = (title, items) => {
                const header = document.createElement('h3');
                header.className = 'text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 mt-8 first:mt-0';
                header.textContent = title;
                content.appendChild(header);

                if (items.length === 0) {
                    const empty = document.createElement('p');
                    empty.className = 'text-xs text-slate-500 italic p-4 bg-slate-900/30 rounded-xl border border-dashed border-border';
                    empty.textContent = `No ${title.toLowerCase()} at the moment.`;
                    content.appendChild(empty);
                    return;
                }

                items.forEach(async res => {
                    const clone = tplRes.content.cloneNode(true);
                    const container = document.createElement('div');
                    container.appendChild(clone);
                    const root = container.firstElementChild;

                    const name = res.userName || res.userEmail || "Driver";
                    root.querySelector('.res-driver-name').textContent = name;
                    root.querySelector('.res-driver-initials').textContent = name.charAt(0).toUpperCase();

                    root.querySelector('.res-spot-name').textContent = res.spotName || `Spot #${res.spotId}`;
                    root.querySelector('.res-date').textContent = res.date;
                    root.querySelector('.res-time').textContent = `${res.startTime} - ${res.endTime}`;
                    root.querySelector('.res-price').textContent = `$${res.totalPrice?.toLocaleString('es-CO') || '0'}`;

                    // Try to fetch the driver's average rating and show it next to their name
                    try {
                        const drvRes = await fetch(`/api/reviews/driver/${res.userId}`);
                        if (drvRes.ok) {
                            const drvReviews = await drvRes.json();
                            if (drvReviews.length > 0) {
                                const avg = (drvReviews.reduce((s, r) => s + r.rating, 0) / drvReviews.length).toFixed(1);
                                const ratingSpan = document.createElement('span');
                                ratingSpan.className = 'flex items-center gap-1 text-[10px] text-yellow-500 font-bold ml-2';
                                ratingSpan.innerHTML = '';
                                const icon = document.createElement('i');
                                icon.setAttribute('data-lucide', 'star');
                                icon.className = 'w-3 h-3 fill-current';
                                ratingSpan.appendChild(icon);
                                ratingSpan.appendChild(document.createTextNode(` ${avg}`));
                                root.querySelector('.res-driver-name').parentElement.appendChild(ratingSpan);
                                if (window.lucide) lucide.createIcons();
                            }
                        }
                    } catch (e) { /* driver rating is optional ÔÇö continue silently */ }

                    const badge = root.querySelector('.res-status-badge');
                    badge.textContent = res.status;
                    if (res.status === 'pending') badge.className += ' bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-500 dark:border-transparent';
                    else if (res.status === 'in-use') badge.className += ' bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-transparent';
                    else if (res.status === 'completed') badge.className += ' bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-transparent';
                    else badge.className += ' bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-transparent';
