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
