/**
 * ARCHIVO: js/payment.js
 * DESCRIPCIÓN: process the payment, initialize EmailJS and save in Database.
 */

// Backend handles the emails via Resend when saving the reservation.
document.addEventListener('DOMContentLoaded', async () => {

    // Back button logic (replaces the onclick in HTML)
    document.getElementById('btn-back-details')?.addEventListener('click', (e) => {
        e.preventDefault();
        history.back();
    });

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const booking = JSON.parse(localStorage.getItem('parkly_booking'));

    // READING FROM DATABASE
    const spots = await DB.getSpots();
    const spot = spots.find(s => s.id == id);

    if (!spot) {
        Alerts.error('Parking spot not found.');
        window.location.href = 'search.html';
        return;
    }

    const set = (elId, text) => {
        const el = document.getElementById(elId);
        if (el) el.textContent = text;
    };

    const sumImg = document.getElementById('summary-img');
    if (sumImg) { sumImg.src = spot.image || ''; sumImg.alt = spot.name; }

    set('summary-name', spot.name);
    set('summary-address', spot.address);
    let totalAmount = spot.price;

    if (booking && booking.spotId == id) {
        totalAmount = booking.total;

        const type = booking.rateType || 'hour';
        const pVal = type === 'hour' ? spot.price : type === 'day' ? (spot.priceDay || spot.price_day) : (spot.priceMonth || spot.price_month);
        set('summary-rate', `$ ${Number(pVal).toLocaleString('es-CO')} / ${type}`);

        if (type === 'hour') {
            set('summary-date', formatDate(booking.date));
            set('summary-time', `${booking.startTime} – ${booking.endTime}`);
            set('summary-duration', `${booking.qty.toFixed(1)} hrs`);
        } else {
            set('summary-date', `${formatDate(booking.date)} - ${formatDate(booking.endDate || booking.date)}`);
            set('summary-time', 'All day');
            set('summary-duration', `${booking.qty} ${type}${booking.qty !== 1 ? 's' : ''}`);
        }

        set('summary-subtotal', `$ ${booking.subtotal.toLocaleString('es-CO')}`);
        set('summary-fee', `$ ${booking.fee.toLocaleString('es-CO')}`);
    } else {
        set('summary-rate', `$ ${Number(spot.price).toLocaleString('es-CO')} / hr`);
    }

    set('summary-total', `$ ${totalAmount.toLocaleString('es-CO')}`);
    set('btn-total', totalAmount.toLocaleString('es-CO'));

    document.getElementById('btn-pay').addEventListener('click', () => {
        const session = JSON.parse(localStorage.getItem('parkly_session'));

        if (!session) {
            Alerts.toast('You must log in to complete the payment.', 'warning');
            window.location.href = 'login.html';
            return;
        }

        const resId = `PK-${Math.floor(Math.random() * 1000000)}`;
        const amountInCents = Math.round(totalAmount * 100);

        // GET INTEGRITY SIGNATURE FROM BACKEND
        fetch('/api/wompi/signature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reference: resId,
                amountInCents: amountInCents,
                currency: 'COP'
            })
        })
            .then(response => response.json())
            .then(data => {
                if (!data.signature) {
                    throw new Error('Could not obtain the payment signature.');
                }

                const checkout = new WidgetCheckout({
                    currency: 'COP',
                    amountInCents: amountInCents,
                    reference: resId,
                    publicKey: 'pub_test_5YLBFidfXmksfQX5KonhVOD7bmVTeWma',
                    signature: { integrity: data.signature }, // <--- INTEGRITY SIGNATURE
                    customerData: {
                        email: session.email,
                        fullName: session.name,
                    },
                });

                checkout.open(function (result) {
                    if (result.transaction.status === 'APPROVED') {
                        ejecutarFlujoExito(session, resId);
                    } else {
                        Alerts.toast('Payment not completed: ' + result.transaction.status, 'warning');
                    }
                });
            })
            .catch(err => {
                console.error(err);
                Alerts.error('Error starting payment: ' + err.message);
            });
    });

    async function ejecutarFlujoExito(session, resId) {

        const conn2 = document.getElementById('conn2');
        const step3Li = document.getElementById('step3-li');
        if (conn2) conn2.classList.replace('bg-border', 'bg-primary');
        if (step3Li) {
            step3Li.querySelector('div').classList.remove('border-border', 'text-slate-500');
            step3Li.querySelector('div').classList.add('bg-primary', 'text-white', 'border-primary');
            step3Li.querySelector('span').classList.replace('text-slate-500', 'text-white');
        }

        // Backend (server.js) will send the confirmation email via Resend
        // when DB.saveReservation calls POST /api/reservations.
        // SAVING IN MYSQL DATABASE (Not in localStorage)
        const reservationData = {
            id: resId,
            spotId: spot.id,
            spotName: spot.name,
            ownerId: spot.ownerId || spot.owner_id,
            userId: session.id,
            userName: session.name,
            userEmail: session.email,
            date: booking?.date || new Date().toISOString().split('T')[0],
            startTime: booking?.rateType !== 'hour' ? '00:00' : (booking?.startTime || '00:00'),
            endTime: booking?.rateType !== 'hour' ? '23:59' : (booking?.endTime || '00:00'),
            total: totalAmount,
            amount: totalAmount, // Keep for fallback
            status: 'pending'
        };

        if (typeof DB !== 'undefined' && DB.saveReservation) {
            await DB.saveReservation(reservationData);
        }

        localStorage.removeItem('parkly_booking');
        Alerts.success(`Payment successful! Receipt sent to: ${session.email}`);
        window.location.href = 'search.html';
    }
});

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}
