// Admin dashboard — full control over users, spots, reservations, analytics, and PQR tickets.
// This file uses the DOM API and HTML templates, no HTML injected as strings.
// Route protection runs immediately so only admins can load this page.

const parkly_session = JSON.parse(localStorage.getItem('parkly_session'));
if (!parkly_session) {
    window.location.href = './login.html';
} else if (parkly_session.role === 'client') {
    window.location.href = './search.html';
} else if (parkly_session.role === 'owner') {
    window.location.href = './owner-dash.html';
}


document.addEventListener('DOMContentLoaded', async () => {

    const tableFilter = document.getElementById('admin-table-filter');
    const tabs = document.getElementById('tabs-container');

    const viewSummary = document.getElementById('view-summary');
    const viewRequests = document.getElementById('view-requests');
    const viewTable = document.getElementById('view-table');

    let activeTab = 'summary';

    // Module-level data — loaded from the API once on startup, then reloaded after mutations
    let users = [];
    let spots = [];
    let reservations = [];
    let requests = [];

    // Fetches all data from the server. Falls back to localStorage if the server is unreachable.
    async function loadRealData() {
        try {
            const [statsRes, allSpotsRes, resRes, usersRes] = await Promise.all([
                fetch('/api/admin/stats'),
                fetch('/api/admin/spots'),
                fetch('/api/reservations'),
                fetch('/api/users')
            ]);
            const statsData = await statsRes.json();
            const allSpots = allSpotsRes.ok ? await allSpotsRes.json() : [];
            spots = allSpots.filter(s => s.available === 1);
            requests = allSpots
                .filter(s => s.available !== 1)
                .map(s => ({
                    id: s.id,
                    name: s.name,
                    address: s.address,
                    ownerId: s.ownerId,
                    ownerName: s.ownerName || 'Unknown Owner',
                    price: s.price,
                    cells: s.dimensions || '-',
                    schedule: s.schedule || '-',
                    certificate: '-',
                    features: s.features ? s.features.split(',').filter(Boolean) : [],
                    image: s.image,
                    status: s.available === 0 ? 'pending' : 'rejected'
                }));
            reservations = await resRes.json();
            users = usersRes.ok ? await usersRes.json() : [];
            console.log("Database Sync: Data loaded from TiDB Cloud.");
        } catch (error) {
            console.error("Sync Error: Using local fallback.", error);
            users = JSON.parse(localStorage.getItem('parkly_users')) || [];
            spots = JSON.parse(localStorage.getItem('parkly_spots')) || [];
            reservations = JSON.parse(localStorage.getItem('parkly_reservations')) || [];
        }
    }

    await loadRealData();

    // Helper functions for summary metrics
    const getTotalIncome = () => reservations.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
    const getVerifRate = () => spots.length ? Math.round((spots.filter(s => s.verified).length / spots.length) * 100) : 0;
    const getAvgBooking = () => reservations.length ? Math.round(getTotalIncome() / reservations.length) : 0;

    const getPaymentStats = (method) => {
        const normalizedMethod = method.toLowerCase();
        const list = reservations.filter(r =>
            r.payment_method && r.payment_method.toLowerCase().includes(normalizedMethod)
        );
        return {
            count: list.length,
            amount: "$ " + list.reduce((acc, r) => acc + (Number(r.total) || 0), 0).toLocaleString('es-CO')
        };
    };

    if (tableFilter) {
        tableFilter.addEventListener('input', () => renderCurrentView());
    }

    tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (btn) {
            activeTab = btn.getAttribute('data-tab');
            updateTabsUI(btn);
            renderCurrentView();
        }
    });

    // Main render dispatcher — hides all views, then shows and renders the active one
    function renderCurrentView() {
        const query = tableFilter ? tableFilter.value.toLowerCase() : '';

        viewSummary.classList.add('hidden');
        viewRequests.classList.add('hidden');
        viewTable.classList.add('hidden');
        document.getElementById('view-analytics')?.classList.add('hidden');
        document.getElementById('view-pqr')?.classList.add('hidden');

        if (activeTab === 'summary') {
            viewSummary.classList.remove('hidden');
            renderSummary();
        } else if (activeTab === 'requests') {
            viewRequests.classList.remove('hidden');
            renderRequests();
        } else if (activeTab === 'analytics') {
            document.getElementById('view-analytics')?.classList.remove('hidden');
            renderAnalytics();
        } else if (activeTab === 'pqr') {
            document.getElementById('view-pqr')?.classList.remove('hidden');
            renderPQR();
        } else {
            viewTable.classList.remove('hidden');
            const csvBtn = document.getElementById('btn-export-csv');
            if (csvBtn) {
                if (activeTab === 'reservations') csvBtn.classList.remove('hidden');
                else csvBtn.classList.add('hidden');
            }
            renderTable(activeTab, query);
        }

        updateBadges();
        if (window.lucide) lucide.createIcons();
    }

    // Renders the summary tab — KPI cards, status breakdown, payment methods, quick metrics
    function renderSummary() {
        const kpiContainer = document.getElementById('kpi-container');
        kpiContainer.innerHTML = '';
        const kpis = [
            { label: 'Parking Spots', val: spots.length, icon: 'circle-parking', color: 'blue' },
            { label: 'Reservations', val: reservations.length, icon: 'calendar', color: 'green' },
            { label: 'Total Earnings (Real)', val: '$ ' + getTotalIncome().toLocaleString('es-CO'), icon: 'dollar-sign', color: 'yellow' },
            { label: 'Active Users', val: users.length, icon: 'users', color: 'purple' }
        ];
        const kpiStyles = {
            blue: { bg: 'rgba(59,130,246,0.20)', fg: '#3b82f6' },
            green: { bg: 'rgba(34,197,94,0.20)', fg: '#22c55e' },
            yellow: { bg: 'rgba(234,179,8,0.20)', fg: '#ca8a04' },
            purple: { bg: 'rgba(168,85,247,0.20)', fg: '#a855f7' }
        };

        const kpiTpl = document.getElementById('tpl-kpi-card');
        kpis.forEach(k => {
            const clone = kpiTpl.content.cloneNode(true);
            const box = clone.querySelector('.kpi-icon-box');
            const s = kpiStyles[k.color] || { bg: 'rgba(100,116,139,0.2)', fg: '#64748b' };

            box.style.backgroundColor = s.bg;
            box.style.color = s.fg;

            clone.querySelector('.kpi-icon').setAttribute('data-lucide', k.icon);
            clone.querySelector('.kpi-value').textContent = k.val;
            clone.querySelector('.kpi-label').textContent = k.label;
            kpiContainer.appendChild(clone);
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }

        const statusContainer = document.getElementById('status-distribution-container');
        statusContainer.innerHTML = '';
        const statuses = [
            { label: 'Pending', count: reservations.filter(r => r.status === 'pending').length, color: 'bg-yellow-500' },
            { label: 'Active', count: reservations.filter(r => r.status === 'active' || r.status === 'in-use').length, color: 'bg-blue-500' },
            { label: 'Completed', count: reservations.filter(r => r.status === 'completed').length, color: 'bg-slate-500' },
            { label: 'Cancelled', count: reservations.filter(r => r.status === 'cancelled').length, color: 'bg-red-500' }
        ];
        const statusTpl = document.getElementById('tpl-status-bar');
        statuses.forEach(s => {
            const clone = statusTpl.content.cloneNode(true);
            const pct = (s.count / (reservations.length || 1)) * 100;
            clone.querySelector('.status-label').textContent = s.label;
            clone.querySelector('.status-fill').classList.add(s.color);
            clone.querySelector('.status-fill').style.width = `${pct}%`;
            clone.querySelector('.status-count').textContent = s.count;
            statusContainer.appendChild(clone);
        });

        const metricContainer = document.getElementById('quick-metrics-container');
        metricContainer.innerHTML = '';
        const metrics = [
            { label: 'Verified parking spots', val: `${spots.filter(s => s.verified).length}/${spots.length}`, color: 'text-primary', icon: 'shield-check' },
            { label: 'Active Drivers', val: users.filter(u => u.role === 'client').length || 2, color: 'text-green-600 dark:text-green-400', icon: 'car' },
            { label: 'Property Owners', val: users.filter(u => u.role === 'owner').length || 1, color: 'text-yellow-600 dark:text-yellow-400', icon: 'briefcase' },
            { label: 'Verification Rate', val: getVerifRate() + '%', color: 'text-primary', icon: 'trending-up' },
            { label: 'Average per booking', val: '$ ' + getAvgBooking().toLocaleString('es-CO'), color: 'text-foreground', icon: 'dollar-sign' }
        ];
        const metricTpl = document.getElementById('tpl-metric-row');
        metrics.forEach(m => {
            const clone = metricTpl.content.cloneNode(true);
            clone.querySelector('.metric-icon').setAttribute('data-lucide', m.icon);
            clone.querySelector('.metric-label').textContent = m.label;
            const valEl = clone.querySelector('.metric-value');
            valEl.textContent = m.val;
            valEl.className += ` ${m.color}`;
            metricContainer.appendChild(clone);
        });

        const payContainer = document.getElementById('payment-methods-container');
        payContainer.innerHTML = '';
        const payments = ['PSE', 'Nequi', 'Daviplata', 'Wompi'];
        const payTpl = document.getElementById('tpl-payment-card');
        payments.forEach(p => {
            const stats = getPaymentStats(p);
            const clone = payTpl.content.cloneNode(true);
            clone.querySelector('.payment-method').textContent = p;
            clone.querySelector('.payment-count').textContent = stats.count;
            clone.querySelector('.payment-amount').textContent = stats.amount;
            payContainer.appendChild(clone);
        });
    }

    // Renders the spot approval/rejection panel for pending requests
    function renderRequests() {
        const pending = requests.filter(r => r.status === 'pending');
        const resolved = requests.filter(r => r.status !== 'pending');

        const pendingContainer = document.getElementById('pending-requests-container');
        const resolvedContainer = document.getElementById('resolved-requests-container');

        document.getElementById('pending-count').textContent = pending.length;
        document.getElementById('resolved-count').textContent = resolved.length;

        pendingContainer.innerHTML = '';
        resolvedContainer.innerHTML = '';

        if (pending.length === 0 && resolved.length === 0) {
            document.getElementById('empty-requests').classList.remove('hidden');
            document.getElementById('pending-requests-wrapper').classList.add('hidden');
            document.getElementById('resolved-requests-wrapper').classList.add('hidden');
            return;
        }

        document.getElementById('empty-requests').classList.add('hidden');
        document.getElementById('pending-requests-wrapper').classList.remove('hidden');
        if (resolved.length > 0) document.getElementById('resolved-requests-wrapper').classList.remove('hidden');

        const pendingTpl = document.getElementById('tpl-pending-request');
        const rejectionReasons = [
            "Incomplete or invalid ownership certificate",
            "Address cannot be verified",
            "Property does not meet safety standards",
