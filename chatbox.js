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