/* =========================================
   PARKLY — Chatbox Widget JS
   Mode 1: Quick Replies (options 1-4)
   Mode 2: Free AI (connects with backend)
   ========================================= */

(function () {

    /* ── CONFIG ── */
    const API_URL = "/api/ai-chat";

    /* ── State ── */
    let mode      = "menu"; // "menu" | "ai"
    let aiHistory = [];

    /* ── DOM ── */
    const toggle     = document.getElementById("chatbox-toggle");
    const panel      = document.getElementById("chatbox-panel");
    const messages   = document.getElementById("chatbox-messages");
    const input      = document.getElementById("chatbox-input");
    const sendBtn    = document.getElementById("chatbox-send");
    const inputArea  = document.getElementById("chat-input-area");
    const backBtn    = document.getElementById("back-btn");
    const modeBadge  = document.getElementById("mode-badge");}


      /* ─────────────────────────────────────────
       HARDCODED FLOWS — options 1 to 4
    ───────────────────────────────────────── */
    const FLOWS = {
        1: [
            { text: "🔍 Use the <strong>search bar</strong> at the top to search by name, address or zone." },
            { text: "In the left panel, filter by <strong>zone</strong>, <strong>max price/hr</strong> and features: EV charging, 24h, security, illuminated or verified." },
            { text: "Cards show an <span style='color:#22c55e;font-weight:600'>Available</span> or <span style='color:#ef4444;font-weight:600'>Occupied</span> badge. Sort by name, lowest price or top rated." },
        ],
        2: [
            { text: "📅 Click any parking card to open its detail page." },
            { text: "Select <strong>date, start time and duration</strong>. The total cost is calculated automatically based on the hourly rate." },
            { text: "Once confirmed, your booking is registered with <strong>pending</strong> status and appears in your dashboard." },
        ],
        3: [
            { text: "💳 Payment is processed from the <strong>payment page</strong> when you confirm your booking." },
            { text: "The total is calculated based on the spot's <strong>hourly rate</strong> and the duration you selected." },
            { text: "To cancel, change your booking status to <strong>Cancelled</strong> from the <strong>Dashboard</strong>." },
        ],
        4: [
            { text: "👤 To sign in, go to <strong>Login</strong> with your registered email and password." },
            { text: "Don't have an account? Use <strong>Register</strong> and enter your name, email and phone." },
            { text: "If you own a parking spot, access the <strong>Owner Dashboard</strong> to manage your spaces and bookings." },
        ],
    };

    
    /* ─────────────────────────────────────────
       HELPERS
    ───────────────────────────────────────── */
    function scrollBottom() {
        messages.scrollTop = messages.scrollHeight;
    }

    function addBubble(html, type = "bot") {
        const div = document.createElement("div");
        div.className = `chat-bubble ${type} bubble-in`;
        div.innerHTML = html;
        messages.appendChild(div);
        scrollBottom();
        return div;
    }

    function showTyping() {
        const el = document.createElement("div");
        el.className = "typing-indicator";
        el.innerHTML = "<span></span><span></span><span></span>";
        messages.appendChild(el);
        scrollBottom();
        return el;
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function showInputArea() {
        inputArea.style.display = "flex";
        requestAnimationFrame(() => inputArea.classList.add("visible"));
        setTimeout(() => input.focus(), 100);
    }

    function hideInputArea() {
        inputArea.classList.remove("visible");
        setTimeout(() => { inputArea.style.display = "none"; }, 300);
    }

    function setModeBadge(isAI) {
        const star = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        modeBadge.innerHTML = isAI
            ? `${star}<span>AI Mode</span>`
            : `${star}<span>Quick Replies</span>`;
        modeBadge.classList.toggle("ai-active", isAI);
    }