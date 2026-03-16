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
            "Duplicate listing detected",
            "Insufficient information provided"
        ];

        pending.forEach(req => {
            const clone = pendingTpl.content.cloneNode(true);
            clone.querySelector('.req-img').src = req.image || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600';
            clone.querySelector('.req-name').textContent = req.name;
            clone.querySelector('.req-address').textContent = req.address;
            clone.querySelector('.req-owner-name').textContent = req.ownerName || 'Unknown Owner';
            clone.querySelector('.req-owner-id').textContent = req.ownerId;
            clone.querySelector('.req-price').textContent = `$ ${Number(req.price).toLocaleString('es-CO')}/hr`;
            clone.querySelector('.req-cells').textContent = `${req.cells} cells`;
            clone.querySelector('.req-schedule').textContent = req.schedule;
            clone.querySelector('.req-cert').textContent = req.certificate;

            const featContainer = clone.querySelector('.req-features');
            if (req.features && Array.isArray(req.features)) {
                req.features.forEach(f => {
                    const span = document.createElement('span');
                    span.className = 'px-2 py-0.5 bg-card rounded text-[10px] text-foreground/90';
                    span.textContent = f;
                    featContainer.appendChild(span);
                });
            }

            // Build a radio list of rejection reasons so the admin must pick one before confirming
            const reasonsContainer = clone.querySelector('.reasons-container');
            reasonsContainer.innerHTML = '';
            rejectionReasons.forEach((reason) => {
                const label = document.createElement('label');
                label.className = 'flex items-center gap-2 cursor-pointer group';

                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `reject-reason-${req.id}`;
                input.value = reason;
                input.className = 'text-red-500';

                const span = document.createElement('span');
                span.className = 'text-xs text-foreground/90 group-hover:text-foreground transition-colors';
                span.textContent = reason;

                label.appendChild(input);
                label.appendChild(span);
                reasonsContainer.appendChild(label);
            });

            const panel = clone.querySelector('.reject-panel');
            const btnsAction = clone.querySelector('.action-buttons');

            clone.querySelector('.btn-approve').addEventListener('click', () => handleApprove(req.id));
            clone.querySelector('.btn-show-reject').addEventListener('click', () => {
                panel.classList.remove('hidden');
                btnsAction.classList.add('hidden');
            });
            clone.querySelector('.btn-cancel-reject').addEventListener('click', () => {
                panel.classList.add('hidden');
                btnsAction.classList.remove('hidden');
            });
            clone.querySelector('.btn-confirm-reject').addEventListener('click', () => {
                const selected = reasonsContainer.querySelector(`input[name="reject-reason-${req.id}"]:checked`);
                if (!selected) return Alerts.toast('Please select a rejection reason before confirming.', 'warning');
                handleReject(req.id, selected.value);
            });

            pendingContainer.appendChild(clone);
        });

        const resolvedTpl = document.getElementById('tpl-resolved-request');
        resolved.forEach(req => {
            const clone = resolvedTpl.content.cloneNode(true);
            const isApproved = req.status === 'approved';
            const iconBox = clone.querySelector('.resolved-icon-box');
            iconBox.classList.add(isApproved ? 'bg-green-500/20' : 'bg-red-500/20', isApproved ? 'text-green-600' : 'text-red-600', 'dark:text-current');
            clone.querySelector('.resolved-icon').setAttribute('data-lucide', isApproved ? 'check' : 'x');
            clone.querySelector('.resolved-name').textContent = req.name;
            clone.querySelector('.resolved-owner').textContent = req.ownerId;
            const badge = clone.querySelector('.resolved-badge');
            badge.textContent = req.status.toUpperCase();
            badge.classList.add(isApproved ? 'bg-green-100' : 'bg-red-100', isApproved ? 'text-green-700' : 'text-red-700', 'dark:bg-opacity-30', 'dark:text-current', 'border', 'dark:border-transparent');
            resolvedContainer.appendChild(clone);
        });
    }

    // Renders a filterable data table for one of: spots, users, or reservations
    function renderTable(type, query) {
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';
        let list = (type === 'spots') ? spots : (type === 'users' ? users : reservations);
        const filtered = list.filter(item => {
            const nameStr = (item.name || item.email || item.spotName || '').toLowerCase();
            return nameStr.includes(query);
        });

        const tpl = document.getElementById('tpl-table-row');
        filtered.forEach(item => {
            const clone = tpl.content.cloneNode(true);
            clone.querySelector('.cell-primary').textContent = item.name || item.email || item.spotName || `ID: ${item.id}`;

            if (type === 'users') {
                const isBlocked = item.status === 'suspended';
                const span = document.createElement('span');
                span.className = `px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${isBlocked ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-900/50' : 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-900/50'}`;
                span.textContent = isBlocked ? 'Blocked' : (item.role || 'Active');
                clone.querySelector('.cell-secondary').appendChild(span);
            } else {
                clone.querySelector('.cell-secondary').textContent = item.verified ? 'Verified' : (item.role || item.status || 'Active');
            }

            const actionsCell = clone.querySelector('.cell-actions');
            if (actionsCell) {
                actionsCell.className = 'p-4 text-right flex gap-2 justify-end';

                if (type === 'users') {
                    const isBlocked = item.status === 'suspended';
                    const btnBlock = document.createElement('button');
                    const blockIcon = document.createElement('i');
                    blockIcon.setAttribute('data-lucide', isBlocked ? 'unlock' : 'ban');
                    blockIcon.className = 'w-3 h-3';
                    btnBlock.appendChild(blockIcon);
                    btnBlock.appendChild(document.createTextNode(isBlocked ? ' Unblock' : ' Block'));

                    btnBlock.className = `flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all ${isBlocked
                        ? 'border-green-600 text-green-600 hover:bg-green-600/10 dark:border-green-800 dark:text-green-400'
                        : 'border-red-600 text-red-600 hover:bg-red-600/10 dark:border-red-900 dark:text-red-400'
                        }`;
                    btnBlock.addEventListener('click', () => handleUserStatus(item.id, isBlocked ? 'active' : 'suspended'));

                    const btnDelete = document.createElement('button');
                    const delIcon = document.createElement('i');
                    delIcon.setAttribute('data-lucide', 'trash-2');
                    delIcon.className = 'w-3 h-3';
                    btnDelete.appendChild(delIcon);
                    btnDelete.appendChild(document.createTextNode(' Delete'));
                    btnDelete.className = 'flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-red-600/10 hover:text-red-600 transition-all';
                    btnDelete.addEventListener('click', () => handleUserStatus(item.id, 'deleted'));

                    actionsCell.appendChild(btnBlock);
                    actionsCell.appendChild(btnDelete);
                }

                if (type === 'reservations' && item.status !== 'cancelled' && item.status !== 'completed') {
                    const btnComplete = document.createElement('button');
                    btnComplete.textContent = 'Complete';
                    btnComplete.className = 'px-3 py-1 text-xs font-bold rounded-lg border border-green-800 text-green-400 hover:bg-green-900/30 transition-all';
                    btnComplete.addEventListener('click', () => handleReservationStatus(item.id, 'completed'));
                    actionsCell.appendChild(btnComplete);

                    const btnCancel = document.createElement('button');
                    btnCancel.textContent = 'Cancel';
                    btnCancel.className = 'px-3 py-1 text-xs font-bold rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-all';
                    btnCancel.addEventListener('click', () => handleCancelReservation(item.id));
                    actionsCell.appendChild(btnCancel);
                }

                if (type === 'spots') {
                    const btnRemove = document.createElement('button');
                    btnRemove.textContent = 'Remove';
                    btnRemove.className = 'px-3 py-1 text-xs font-bold rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition-all';
                    btnRemove.addEventListener('click', () => handleDeleteSpot(item.id, item.name));
                    actionsCell.appendChild(btnRemove);
                }
            }

            tbody.appendChild(clone);
        });
    }

    // Renders Chart.js charts and the top spots list using real data from /api/admin/metrics-all.
    // Only runs once per session — re-runs if the user forces it by resetting ownerChartsInit.
    let chartsInitialized = false;
    async function renderAnalytics() {
        if (chartsInitialized) return;
        chartsInitialized = true;

        try {
            const res = await fetch('/api/admin/metrics-all');
            const metrics = await res.json();

            const ctx1 = document.getElementById('chart-revenue').getContext('2d');
            new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                        label: 'Real Monthly Revenue (COP)',
                        data: metrics.monthly_revenue,
                        backgroundColor: 'rgba(59,130,246,0.8)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels: { color: '#94a3b8', font: { weight: 'bold' } } },
                        tooltip: { backgroundColor: '#1e293b', titleFont: { weight: 'bold' }, padding: 12 }
                    },
                    scales: {
                        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,41,59,0.5)' } },
                        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30,41,59,0.5)' } }
                    }
                }
            });

            const ctx2 = document.getElementById('chart-occupancy').getContext('2d');
            new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Occupied', 'Available'],
                    datasets: [{
                        data: [metrics.occupancy_rate, 100 - metrics.occupancy_rate],
                        backgroundColor: ['#3b82f6', 'rgba(30,41,59,0.5)'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels: { color: '#94a3b8', font: { weight: 'bold' } } }
                    },
                    cutout: '70%'
                }
            });

            const container = document.getElementById('top-spots-container');
            container.innerHTML = '';
            const tplSpot = document.getElementById('tpl-top-spot');
            if (tplSpot) {
                metrics.top_spots.forEach((s, i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const clone = tplSpot.content.cloneNode(true);
                    clone.querySelector('.spot-medal').textContent = medals[i] || '📈';
                    clone.querySelector('.spot-name').textContent = s.name;
                    clone.querySelector('.spot-bookings').textContent = `${s.reservation_count} bookings`;
                    container.appendChild(clone);
                });
            }

            console.log("Analytics: Global KPIs synchronized with database.");

        } catch (e) {
            console.error("Metrics UI Error:", e);
            const err = document.createElement('p');
            err.className = 'p-8 text-foreground/40 text-sm text-center italic';
            err.textContent = 'Failed to calculate live analytics.';
            document.getElementById('top-spots-container').replaceChildren(err);
        }
    }

    // Fetches and renders all PQR support tickets. Open tickets get a response textarea.
    async function renderPQR() {
        const container = document.getElementById('pqr-list');
        const empty = document.getElementById('pqr-empty');
        container.innerHTML = '';
        try {
            const res = await fetch('/api/pqr');
            const pqrs = res.ok ? await res.json() : [];
            const pqrBadge = document.getElementById('badge-pqr');
            const openPQRs = pqrs.filter(p => p.status !== 'resolved');
            if (pqrBadge) pqrBadge.textContent = openPQRs.length;

            if (pqrs.length === 0) { empty.classList.remove('hidden'); return; }
            empty.classList.add('hidden');

            const tplPQR = document.getElementById('tpl-admin-pqr');
            pqrs.forEach(p => {
                if (!tplPQR) return;
                const clone = tplPQR.content.cloneNode(true);
                const card = clone.querySelector('article');

                const isRespond = p.status !== 'resolved';

                clone.querySelector('.pqr-type').textContent = p.type;
                clone.querySelector('.pqr-subject').textContent = p.subject || 'No subject';
                clone.querySelector('.pqr-user').textContent = p.user_name;
                clone.querySelector('.pqr-date').textContent = new Date(p.created_at).toLocaleDateString();

                const badge = clone.querySelector('.pqr-badge');
                badge.textContent = p.status.toUpperCase();
                badge.className += p.status === 'open' ? ' text-red-700 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800/30' : ' text-yellow-700 bg-yellow-100 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800/30';

                clone.querySelector('.pqr-desc').textContent = p.description || '-';

                const actionArea = clone.querySelector('.pqr-action-area');
                if (isRespond) {
                    const wrap = document.createElement('div');
                    wrap.className = 'flex gap-2';

                    const textarea = document.createElement('textarea');
                    textarea.dataset.pqrId = p.id;
                    textarea.className = 'flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder-foreground/30 focus:outline-none focus:border-primary resize-none';
                    textarea.rows = 2;
                    textarea.placeholder = 'Write your response...';

                    const btn = document.createElement('button');
                    btn.dataset.respond = p.id;
                    btn.className = 'px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground text-xs font-bold rounded-xl transition-all';
                    btn.textContent = 'Respond';

                    wrap.appendChild(textarea);
                    wrap.appendChild(btn);
                    actionArea.appendChild(wrap);
                } else {
                    const pResp = document.createElement('p');
                    pResp.className = 'text-xs text-green-400 border border-green-800/30 bg-green-900/20 rounded-xl p-3';
                    pResp.textContent = p.admin_response;
                    actionArea.appendChild(pResp);
                }

                const respondBtn = card.querySelector('[data-respond]');
                if (respondBtn) {
                    respondBtn.addEventListener('click', async () => {
                        const textarea = card.querySelector(`[data-pqr-id="${p.id}"]`);
                        const response = textarea?.value?.trim();
                        if (!response) return Alerts.toast('Please write a response.', 'warning');
                        await fetch(`/api/pqr/${p.id}/respond`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ admin_response: response, status: 'resolved' })
                        });
                        renderPQR();
                    });
                }
                container.appendChild(card);
            });
        } catch (e) {
            empty.classList.remove('hidden');
        }
