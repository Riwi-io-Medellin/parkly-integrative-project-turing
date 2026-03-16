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
