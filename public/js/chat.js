// chat feature with two modes:
// - hub view: list of all conversations
// - individual chat: messages for one specific reservation
// which one loads depends on whether there's a ?res_id= in the URL

document.addEventListener('DOMContentLoaded', async () => {
    const session = JSON.parse(localStorage.getItem('parkly_session'));
    if (!session) {
        window.location.href = './index.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const resId = params.get('res_id');

    document.getElementById('nav-back-btn').onclick = () => {
        if (resId) {
            window.location.href = 'chat.html';
        } else {
            if (session.role === 'owner') {
                window.location.href = 'owner-dash.html';
            } else {
                window.location.href = 'search.html';
            }
        }
    };

    if (!resId) {
        await initializeChatHub(session);
    } else {
        await initializeChat(session, resId);
    }
});

// loads every conversation the user is part of (one per reservation)
// matches by both email and userId to handle old and new records
async function initializeChatHub(session) {
    document.getElementById('chat-hub-view').classList.remove('hidden');
    document.getElementById('header-hub-title').classList.remove('hidden');
    document.getElementById('header-chat-info').classList.add('hidden');
    document.getElementById('chat-footer').classList.add('hidden');

    const container = document.getElementById('chat-list-container');
    const tpl = document.getElementById('tpl-chat-item');

    const showEmpty = () => {
        const tpl = document.getElementById('tpl-chat-empty-hub');
        if (tpl) {
            container.replaceChildren(tpl.content.cloneNode(true));
            if (window.lucide) lucide.createIcons();
        }
    };

    try {
        const resResponse = await fetch('/api/reservations');
        if (!resResponse.ok) { showEmpty(); return; }
        const reservations = await resResponse.json();
        if (!Array.isArray(reservations)) { showEmpty(); return; }

        // grab the user list so we can show partner names and avatars
        let users = [];
        try {
            const usersResponse = await fetch('/api/users');
            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                if (Array.isArray(usersData)) users = usersData;
            }
        } catch (e) { }

        const myReservations = reservations.filter(r =>
            (r.userEmail && r.userEmail.toLowerCase() === session.email.toLowerCase()) ||
            (r.userId && String(r.userId) === String(session.id)) ||
            (String(r.ownerId) === String(session.id))
        );

        if (myReservations.length === 0) { showEmpty(); return; }

        container.innerHTML = '';

        myReservations.forEach(r => {
            const isOwner = String(r.ownerId) === String(session.id);
            let partner;
            let partnerEmail;

            if (isOwner) {
                partnerEmail = r.userEmail;
                partner = users.find(u => u.email && u.email.toLowerCase() === (partnerEmail || '').toLowerCase());
            } else {
                partner = users.find(u => String(u.id) === String(r.ownerId));
                partnerEmail = partner?.email;
            }

            const clone = tpl.content.cloneNode(true);
            const item = clone.querySelector('.chat-item');

            item.onclick = () => window.location.href = `chat.html?res_id=${r.id}`;

            clone.querySelector('.item-name').textContent = partner?.name || (partnerEmail ? partnerEmail.split('@')[0] : (isOwner ? 'Driver' : 'Owner'));
            clone.querySelector('.item-context').textContent = `${r.spotName || 'Spot'} (${r.date})`;

            if (partner?.avatar_url) {
                const img = clone.querySelector('.item-avatar');
                img.src = partner.avatar_url;
                img.classList.remove('hidden');
                clone.querySelector('.item-initials').classList.add('hidden');
            } else {
                const nameStr = partner?.name || partnerEmail || (isOwner ? 'D' : 'O');
                clone.querySelector('.item-initials').textContent = nameStr[0].toUpperCase();
            }

            container.appendChild(clone);
        });

        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error("Hub error:", e);
        showEmpty();
    }
}

// opens the individual chat for a specific reservation
async function initializeChat(session, resId) {
    document.getElementById('individual-chat-view').classList.remove('hidden');
    document.getElementById('header-chat-info').classList.remove('hidden');
    document.getElementById('header-hub-title').classList.add('hidden');
    document.getElementById('chat-footer').classList.remove('hidden');

    let reservation, partnerInfo;

    try {
        const reservations = await (await fetch('/api/reservations')).json();
        const sessionEmail = (session.email || '').toLowerCase();
        const sessionId = String(session.id);

        reservation = reservations.find(r => {
            const isMyRes = (r.userEmail && r.userEmail.toLowerCase() === sessionEmail) ||
                (r.userId && String(r.userId) === sessionId) ||
                (String(r.ownerId) === sessionId);
            return r.id === resId && isMyRes;
        });

        if (!reservation) throw new Error('Reservation not found or access denied');

        const users = await (await fetch('/api/users')).json();
        const isOwner = String(reservation.ownerId) === sessionId;

        let partnerEmail;

        if (isOwner) {
            partnerEmail = reservation.userEmail;
            partnerInfo = users.find(u => u.email && u.email.toLowerCase() === (partnerEmail || '').toLowerCase());
        } else {
            partnerInfo = users.find(u => String(u.id) === String(reservation.ownerId));
            partnerEmail = partnerInfo?.email;
        }

        document.getElementById('chat-partner-display-name').textContent = partnerInfo?.name || (partnerEmail ? partnerEmail.split('@')[0] : 'Unknown');
        document.getElementById('chat-context').textContent = `Re: ${reservation.spotName || 'Spot'} (${reservation.date})`;

        if (partnerInfo?.avatar_url) {
            const img = document.getElementById('chat-partner-img');
            img.src = partnerInfo.avatar_url;
            img.classList.remove('hidden');
            document.getElementById('chat-partner-initial').classList.add('hidden');
        } else {
            document.getElementById('chat-partner-initial').textContent = (partnerInfo?.name || partnerEmail)[0].toUpperCase();
        }

        const form = document.getElementById('chat-form');
        const input = document.getElementById('chat-input');

        form.onsubmit = async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            input.style.height = 'auto';
            await sendMessage(session, resId, partnerEmail, text);
        };

        // enter sends, shift+enter makes a newline
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        };

        // auto-grow the textarea
        input.oninput = function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        };

        await loadMessages(session, resId);
        // poll every 3s so new messages show up without a manual refresh
        setInterval(() => loadMessages(session, resId, true), 3000);

    } catch (e) {
        console.error("Chat init error:", e);
        const err = document.createElement('p');
        err.className = 'text-red-400 text-center py-20';
        err.textContent = e.message;
        document.getElementById('chat-messages').replaceChildren(err);
    }
}

async function sendMessage(session, resId, partnerEmail, text) {
    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;

    try {
        const payload = {
            reservationId: resId,
            senderId: session.id,
            senderEmail: session.email,
            receiverEmail: partnerEmail,
            message: text
        };

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to send");
        await loadMessages(session, resId);

    } catch (error) {
        Alerts.error("Failed to send message.");
    } finally {
        btn.disabled = false;
        document.getElementById('chat-input').focus();
    }
}

// used to skip re-renders when polling finds no new messages
let lastMessageCount = 0;

async function loadMessages(session, resId, isPolling = false) {
    try {
        const response = await fetch(`/api/chat/${resId}`);
        if (!response.ok) return;

        const messages = await response.json();
        if (isPolling && messages.length === lastMessageCount) return;
        lastMessageCount = messages.length;

        const container = document.getElementById('chat-messages');
        const tplSent = document.getElementById('tpl-msg-sent');
        const tplReceived = document.getElementById('tpl-msg-received');

        if (messages.length === 0) {
            const noMsg = document.createElement('div');
            noMsg.className = 'text-center text-foreground/90 py-10';
            noMsg.textContent = 'No messages yet.';
            container.replaceChildren(noMsg);
            return;
        }

        container.innerHTML = '';

        messages.forEach(msg => {
            const myEmail = (session.email || '').toLowerCase();
            const senderEmail = (msg.senderEmail || '').toLowerCase();
            const isMe = senderEmail === myEmail || String(msg.senderId) === String(session.id);

            const clone = (isMe ? tplSent : tplReceived).content.cloneNode(true);
            clone.querySelector('.msg-text').textContent = msg.message;
            const timeObj = new Date(msg.createdAt);
            clone.querySelector('.msg-time').textContent = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            container.appendChild(clone);
        });

        container.scrollTop = container.scrollHeight;
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error("Load messages error:", e);
    }
}
