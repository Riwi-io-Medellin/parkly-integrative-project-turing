/**
* ARCHIVO: js/detail.js
* DESCRIPCIÓN: 100% Lógica. Sin HTML inyectado por strings, mostrando los datos de la base de datos y del mapa.
*/

let currentSpot = null;
let currentImgIdx = 0;
let selectedRateType = 'hour'; // 'hour', 'day', 'month'

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const res = await fetch(`/api/spots/${id}`);
  currentSpot = await res.json();
  if (!currentSpot) { window.location.href = 'search.html'; return; }
  
  fillPage();
  setupModals();
  loadRealReviews(id);
  setupFavoriteBtn(id);
  setupGoogleMapsLink();
  setupWaitlist(id);
  loadGoogleMaps();
});


// ─── GOOGLE MAPS (API KEY desde backend) ──────────────────
async function loadGoogleMaps() {
  try {
    const res = await fetch('/api/config/maps-key');
    const { key } = await res.json();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initMap&loading=async`;
    script.defer = true;
    document.head.appendChild(script);
  } catch (e) {
    console.error('No se pudo cargar Google Maps:', e);
  }
}

window.initMap = function () {
  if (!currentSpot) return;
  const lat = parseFloat(currentSpot.latitude) || 6.2442;
  const lng = parseFloat(currentSpot.longitude) || -75.5812;
  const lugar = { lat, lng };
  const map = new google.maps.Map(document.getElementById('map'), {
    center: lugar,
    zoom: 16,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });
  new google.maps.Marker({
    position: lugar,
    map,
    title: currentSpot.name,
    animation: google.maps.Animation.DROP,
  });
};

function setupModals() {
  const btnOpenMap = document.getElementById('btn-open-map');
  const btnCloseMap = document.getElementById('btn-close-map');
  if (btnOpenMap) btnOpenMap.addEventListener('click', openMapModal);
  if (btnCloseMap) btnCloseMap.addEventListener('click', closeMapModal);
}

// checking if maps opens correctly and shows the correct address of the parking location
function openMapModal() {
  const modal = document.getElementById('map-modal');
  const iframe = document.getElementById('map-iframe');
  if (!modal || !iframe) return;
  setText('map-modal-title', currentSpot.name);
  modal.showModal();
  const lat = parseFloat(currentSpot.latitude) || 6.2442;
  const lng = parseFloat(currentSpot.longitude) || -75.5812;
  iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}


function closeMapModal() {
  document.getElementById('map-modal')?.close();
}

function fillPage() {
  const p = currentSpot;
  const avg = calcAvgRating(p);
  const displayRating = (p.reviews && p.reviews.length > 0) ? avg : (Number(p.rating) || 0);
  document.title = `${p.name} – PARKLY`;

  const session = JSON.parse(localStorage.getItem('parkly_session'));
  if (session) {
    setText('nav-username', session.name || session.email);
    setText('nav-role', session.role || 'Driver');
  }

  const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  const mainImg = document.getElementById('gallery-main-img');
  if (mainImg) {
    mainImg.src = images[0] || '';
    mainImg.alt = `Main photo of ${p.name}`;
  }

  const prevBtn = document.getElementById('gallery-prev');
  const nextBtn = document.getElementById('gallery-next');
  if (prevBtn && nextBtn) {
    if (images.length > 1) {
      prevBtn.classList.remove('hidden');
      nextBtn.classList.remove('hidden');
      const newPrev = prevBtn.cloneNode(true);
      const newNext = nextBtn.cloneNode(true);
      prevBtn.parentNode.replaceChild(newPrev, prevBtn);
      nextBtn.parentNode.replaceChild(newNext, nextBtn);
      newPrev.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (currentImgIdx > 0) changeImage(currentImgIdx - 1);
      });
      newNext.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (currentImgIdx < images.length - 1) changeImage(currentImgIdx + 1);
      });
    } else {
      prevBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
    }
  }

  const thumbsContainer = document.getElementById('gallery-thumbs');
  const thumbTpl = document.getElementById('tpl-gallery-thumb');
  if (thumbsContainer && thumbTpl && images.length > 1) {
    thumbsContainer.innerHTML = '';
    images.forEach((src, i) => {
      const clone = thumbTpl.content.cloneNode(true);
      const btn = clone.querySelector('button');
      const img = clone.querySelector('img');
      img.src = src;
      img.alt = `Photo ${i + 1} of ${p.name}`;
      btn.setAttribute('aria-label', `Photo ${i + 1}`);
      btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      if (i === 0) {
        btn.classList.replace('border-transparent', 'border-primary');
        btn.classList.remove('opacity-50');
      }
      btn.addEventListener('click', (e) => changeImage(i, e.currentTarget));
      thumbsContainer.appendChild(clone);
    });
  } else if (thumbsContainer) {
    hide('gallery-thumbs');
  }

  updateGalleryNav(images.length);

  setText('spot-name', p.name);
  setText('spot-owner', p.ownerName || 'Unknown Owner');
  setText('spot-address-text', p.address);
  setText('spot-rating', Number(displayRating).toFixed(1));
  setText('spot-review-count', `(${(p.reviews && p.reviews.length) || p.reviewCount || 0} reviews)`);

  const pd = p.priceDay || p.priceday || p.price_day;
  const pm = p.priceMonth || p.pricemonth || p.price_month;
  setText('price-hour', p.price ? `$ ${Number(p.price).toLocaleString('es-CO')}` : '—');
  setText('price-day', pd ? `$ ${Number(pd).toLocaleString('es-CO')}` : '—');
  setText('price-month', pm ? `$ ${Number(pm).toLocaleString('es-CO')}` : '—');
  setText('booking-price', p.price ? `$ ${Number(p.price).toLocaleString('es-CO')}` : '—');

  if (p.occupiedSpots != null && p.totalSpots) {
    const occupancy = Math.round((p.occupiedSpots / p.totalSpots) * 100);
    setText('occupancy-pct', `${occupancy}%`);
    const spotsLeftEl = document.getElementById('spots-left');
    if (spotsLeftEl) {
      spotsLeftEl.textContent = `${p.totalSpots - p.occupiedSpots} spots free`;
      spotsLeftEl.className = `font-bold ${p.totalSpots - p.occupiedSpots > 0 ? 'text-green-400' : 'text-red-400'}`;
    }
    const bar = document.getElementById('occupancy-bar');
    if (bar) {
      bar.style.width = `${occupancy}%`;
      bar.className = `h-full rounded-full transition-all duration-700 ${occupancy > 80 ? 'bg-red-500' : occupancy > 50 ? 'bg-yellow-500' : 'bg-primary'}`;
    }
    show('occupancy-section');
  }

  if (p.phone) {
    const phoneEl = document.getElementById('spot-phone');
    if (phoneEl) { phoneEl.textContent = p.phone; phoneEl.href = `tel:${p.phone}`; }
    show('contact-section');
  }

  if (p.maxwidth || p.max_width || p.maxlength || p.max_length || p.maxheight || p.max_height || p.vehicletypes || p.vehicle_types) {
    setText('dim-width', (p.maxwidth || p.max_width) ? `${p.maxwidth || p.max_width}m` : 'Any');
    setText('dim-length', (p.maxlength || p.max_length) ? `${p.maxlength || p.max_length}m` : 'Any');
    setText('dim-height', (p.maxheight || p.max_height) ? `${p.maxheight || p.max_height}m` : 'Any');
    const typesContainer = document.getElementById('dim-types');
    const types = p.vehicletypes || p.vehicle_types;
    if (typesContainer && types) {
      typesContainer.innerHTML = '';
      types.split(',').forEach(t => {
        const badge = document.createElement('span');
        badge.className = 'px-2 py-0.5 bg-card border border-border rounded text-xs text-foreground/70';
        badge.textContent = t.trim();
        typesContainer.appendChild(badge);
      });
    }
    show('dimensions-section');
  }

  setText('spot-description', p.description || '');
  setText('spot-type', p.type || '');

  if (p.amenities) {
    const amenitiesList = document.getElementById('spot-amenities-list');
    if (amenitiesList) {
      amenitiesList.innerHTML = '';
      const items = Array.isArray(p.amenities) ? p.amenities : p.amenities.split(',');
      items.forEach(a => {
        const badge = document.createElement('span');
        badge.className = 'px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold';
        badge.textContent = a.trim();
        amenitiesList.appendChild(badge);
      });
    }
    show('spot-amenities-section');
  }

  fillReviews(p.reviews || []);

  if (p.status !== 0 && p.status !== false && p.available !== false) {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('book-date');
    const endDateInput = document.getElementById('book-end-date');
    if (dateInput) { dateInput.min = today; dateInput.value = today; }
    if (endDateInput) { endDateInput.min = today; endDateInput.value = today; }
    document.getElementById('book-start')?.addEventListener('change', calcPrice);
    document.getElementById('book-end')?.addEventListener('change', calcPrice);
    document.getElementById('book-date')?.addEventListener('change', calcPrice);
    document.getElementById('book-end-date')?.addEventListener('change', calcPrice);
    document.getElementById('booking-form')?.addEventListener('submit', goToBooking);
    setupRateSelectors();
    calcPrice();
  } else {
    hide('booking-available');
    show('booking-full');
  }

  if (window.lucide) lucide.createIcons();
}

async function loadRealReviews(spotId) {
  try {
    const res = await fetch(`/api/reviews/spot/${spotId}`);
    if (!res.ok) { console.warn('Reviews API returned error', res.status); return; }
    const reviews = await res.json();
    fillReviews(reviews);
  } catch (e) {
    console.error('Could not load reviews from API', e);
  }
}

function fillReviews(reviews) {
  const list = document.getElementById('reviews-list');
  const tpl = document.getElementById('tpl-review');
  const noMsg = document.getElementById('no-reviews-msg');
  if (!list || !tpl) return;
  list.innerHTML = '';
  if (!reviews || reviews.length === 0) {
    if (noMsg) noMsg.classList.remove('hidden');
    return;
  }
  if (noMsg) noMsg.classList.add('hidden');
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  setText('spot-rating', avg.toFixed(1));
  setText('spot-review-count', `(${reviews.length} reviews)`);
  reviews.forEach(r => {
    const clone = tpl.content.cloneNode(true);
    const name = r.reviewername || r.reviewer_name || 'Anonymous';
    clone.querySelector('.user-initial').textContent = name[0].toUpperCase();
    clone.querySelector('.user-name').textContent = name;
    clone.querySelector('.review-date').textContent = (r.createdAt || r.created_at)
      ? new Date(r.createdAt || r.created_at).toLocaleDateString('es-CO') : '';
    clone.querySelector('.review-stars').textContent = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    clone.querySelector('.review-comment').textContent = r.comment || '';
    list.appendChild(clone);
  });
}

async function setupFavoriteBtn(spotId) {
  const favBtn = document.getElementById('btn-favorite');
  if (!favBtn) return;
  const session = JSON.parse(localStorage.getItem('parkly_session'));
  if (!session) {
    favBtn.addEventListener('click', () => Alerts.toast('Please log in to add favorites.', 'warning'));
    return;
  }
  let isFav = false;
  try {
    const res = await fetch(`/api/users/${session.id}/favorites`);
    if (res.ok) { const favs = await res.json(); isFav = favs.some(f => String(f.id) === String(spotId)); }
  } catch (e) { console.error('Error loading favorites', e); }
  favBtn.textContent = isFav ? '❤️' : '🤍';
  favBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
  favBtn.addEventListener('click', async () => {
    try {
      if (isFav) {
        await fetch(`/api/users/${session.id}/favorites/${spotId}`, { method: 'DELETE' });
        isFav = false;
      } else {
        await fetch(`/api/users/${session.id}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spotId })
        });
        isFav = true;
      }
      favBtn.textContent = isFav ? '❤️' : '🤍';
      favBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    } catch (e) { Alerts.error('Failed to update favorites.'); }
  });
}

function setupGoogleMapsLink() {
  const btn = document.getElementById('btn-directions');
  if (!btn || !currentSpot) return;
  const query = encodeURIComponent(`${currentSpot.address} ${currentSpot.name}`);
  btn.href = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
}

function setupWaitlist(spotId) {
  const btn = document.getElementById('btn-waitlist');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const session = JSON.parse(localStorage.getItem('parkly_session'));
    if (!session) { Alerts.toast('Please log in to join the waitlist.', 'warning'); window.location.href = 'login.html'; return; }
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.id, spot_id: spotId })
      });
      const data = await res.json();
      if (res.ok) {
        btn.textContent = "✅ You're on the waitlist!";
        btn.disabled = true;
        btn.className = btn.className.replace('bg-primary', 'bg-green-700');
      } else { Alerts.error(data.error || 'Could not join waitlist.'); }
    } catch (e) { Alerts.error('Server error. Please try again.'); }
  });
}

function setupRateSelectors() {
  const cards = document.querySelectorAll('.rate-card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;
      const pd = currentSpot.priceDay || currentSpot.priceday || currentSpot.price_day;
      const pm = currentSpot.priceMonth || currentSpot.pricemonth || currentSpot.price_month;
      if ((type === 'day' && !pd) || (type === 'month' && !pm)) return;
      selectedRateType = type;
      cards.forEach(c => { c.classList.remove('border-primary', 'bg-primary/10'); c.classList.add('border-border'); });
      e.currentTarget.classList.remove('border-border');
      e.currentTarget.classList.add('border-primary', 'bg-primary/10');
      const lbl = type === 'hour' ? 'Price / hour' : type === 'day' ? 'Price / day' : 'Price / month';
      setText('booking-price-label', lbl);
      const priceVal = type === 'hour' ? currentSpot.price : type === 'day' ? pd : pm;
      setText('booking-price', `$ ${Number(priceVal).toLocaleString('es-CO')}`);
      const timeInputsWrap = document.getElementById('time-inputs');
      const endLabel = document.getElementById('lbl-end-date');
      if (type === 'hour') {
        timeInputsWrap?.classList.remove('hidden');
        endLabel?.classList.add('hidden');
      } else {
        timeInputsWrap?.classList.add('hidden');
        endLabel?.classList.remove('hidden');
      }
      calcPrice();
    });
  });
}

function calcPrice() {
  const start = document.getElementById('book-date')?.value;
  const startTimeTime = document.getElementById('book-start')?.value;
  const endTimeTime = document.getElementById('book-end')?.value;
  const endDateVal = document.getElementById('book-end-date')?.value || start;
  const btnBook = document.getElementById('btn-book');
  const errEl = document.getElementById('calc-error');
  const breakEl = document.getElementById('calc-breakdown');
  if (!start || !errEl || !breakEl) return;

  let subtotal = 0, durationText = '', isValid = true, qty = 1;
  const pd = currentSpot.priceDay || currentSpot.priceday || currentSpot.price_day;
  const pm = currentSpot.priceMonth || currentSpot.pricemonth || currentSpot.price_month;
  const p = currentSpot.price;

  if (selectedRateType === 'hour') {
    if (!startTimeTime || !endTimeTime) return;
    const parseT = (val) => {
      const m = val.match(/(\d+):(\d+)/);
      if (!m) return null;
      let h = parseInt(m[1]), min = parseInt(m[2]);
      if (val.toLowerCase().includes('p.m.') || val.toLowerCase().includes('pm')) { if (h !== 12) h += 12; }
      else if (val.toLowerCase().includes('a.m.') || val.toLowerCase().includes('am')) { if (h === 12) h = 0; }
      return h + min / 60;
    };
    const t1 = parseT(startTimeTime), t2 = parseT(endTimeTime);
    errEl.textContent = 'Please select a valid time range.';
    if (t1 === null || t2 === null || t2 <= t1) { isValid = false; }
    else {
      const schedule = currentSpot.schedule || '24h';
      if (schedule !== '24h') {
        const bookDate = new Date(`${start}T12:00:00`);
        const dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
        const dayName = dayNames[bookDate.getDay()];
        if (schedule === 'day' || schedule === 'day 06:00-22:00') {
          if (t1 < 6 || t2 > 22) { errEl.textContent = 'This spot is only available 06:00–22:00.'; isValid = false; }
        } else if (schedule.startsWith('custom:')) {
          try {
            const customSched = JSON.parse(schedule.slice(7));
            if (!customSched[dayName]) {
              errEl.textContent = `This spot is not available on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.`;
              isValid = false;
            } else {
              const [open, close] = customSched[dayName];
              const openDec = parseT(open), closeDec = parseT(close);
              if (t1 < openDec || t2 > closeDec) { errEl.textContent = `Available ${open}–${close} on this day.`; isValid = false; }
            }
          } catch (e) {}
        }
      }
      if (isValid) { qty = t2 - t1; durationText = `${qty.toFixed(1)} hrs`; subtotal = Math.ceil(qty) * Number(p); }
    }
  } else {
    const d1 = new Date(`${start}T12:00:00`);
    const d2 = new Date(`${endDateVal}T12:00:00`);
    const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    if (days <= 0) { isValid = false; }
    else if (selectedRateType === 'day') { qty = days; durationText = `${qty} days`; subtotal = qty * Number(pd); }
    else if (selectedRateType === 'month') { qty = Math.ceil(days / 30); durationText = `${qty} months`; subtotal = qty * Number(pm); }
  }

  if (!isValid) {
    errEl.classList.remove('hidden'); breakEl.classList.add('hidden');
    if (btnBook) btnBook.disabled = true;
    return;
  }

  const fee = Math.round(subtotal * 0.05);
  errEl.classList.add('hidden'); breakEl.classList.remove('hidden');
  setText('val-duration', durationText);
  setText('val-subtotal', `$ ${subtotal.toLocaleString('es-CO')}`);
  setText('val-fee', `$ ${fee.toLocaleString('es-CO')}`);
  setText('val-total', `$ ${(subtotal + fee).toLocaleString('es-CO')}`);
  if (btnBook) btnBook.disabled = false;

  localStorage.setItem('parkly_booking', JSON.stringify({
    spotId: currentSpot.id,
    ownerId: currentSpot.ownerId || currentSpot.ownerid || currentSpot.owner_id,
    date: start, endDate: endDateVal,
    startTime: startTimeTime, endTime: endTimeTime,
    rateType: selectedRateType, qty, subtotal, fee,
    total: subtotal + fee
  }));
}

function goToBooking(e) {
  if (e) e.preventDefault();
  const session = JSON.parse(localStorage.getItem('parkly_session'));
  if (!session) { Alerts.toast('You need to log in to book a spot.', 'warning'); window.location.href = 'login.html'; return; }
  const booking = JSON.parse(localStorage.getItem('parkly_booking') || '{}');
  if (!booking.total) return Alerts.toast('Please select a valid time range first.', 'warning');
  window.location.href = `payment.html?id=${currentSpot.id}`;
}

function changeImage(index) {
  currentImgIdx = index;
  const mainImg = document.getElementById('gallery-main-img');
  if (mainImg && currentSpot) {
    const images = (currentSpot.images && currentSpot.images.length) ? currentSpot.images : [currentSpot.image];
    mainImg.src = images[index];
    updateGalleryNav(images.length);
    document.querySelectorAll('#gallery-thumbs button').forEach((b, i) => {
      const active = i === index;
      b.setAttribute('aria-pressed', active);
      b.classList.toggle('border-primary', active);
      b.classList.toggle('border-transparent', !active);
      b.classList.toggle('opacity-50', !active);
      if (active) b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }
}

function updateGalleryNav(totalImages) {
  const prevBtn = document.getElementById('gallery-prev');
  const nextBtn = document.getElementById('gallery-next');
  if (prevBtn && nextBtn) {
    prevBtn.disabled = currentImgIdx === 0;
    nextBtn.disabled = currentImgIdx === totalImages - 1;
  }
}

function calcAvgRating(p) {
  if (!p.reviews || p.reviews.length === 0) return p.rating || 0;
  return p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length;
}

function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
