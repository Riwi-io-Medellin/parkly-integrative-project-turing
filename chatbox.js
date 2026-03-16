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

      /* ─────────────────────────────────────────
       MAIN MENU
    ───────────────────────────────────────── */
    function buildMenu() {
        const chevron = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5 shrink-0 opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>`;
        const wrap = document.createElement("div");
        wrap.className = "quick-options";
        wrap.id = "quick-options";
        wrap.innerHTML = `
            <p class="quick-options-label">What can I help you with?</p>
            <ul class="flex flex-col gap-1.5 w-full">

                <li>
                    <button data-flow="1" class="group flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 text-left transition-all duration-200 active:scale-[0.98]">
                        <div class="shrink-0 rounded-lg border border-blue-500/40 bg-blue-500/15 p-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-400">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <strong class="block text-[13px] font-semibold text-slate-200">1. Find parking</strong>
                            <small class="block text-[11px] font-normal text-slate-500">Filters, zones and availability</small>
                        </div>
                        ${chevron}
                    </button>
                </li>

                <li>
                    <button data-flow="2" class="group flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-left transition-all duration-200 active:scale-[0.98]">
                        <div class="shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/15 p-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-cyan-400">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <strong class="block text-[13px] font-semibold text-slate-200">2. Make a booking</strong>
                            <small class="block text-[11px] font-normal text-slate-500">Steps to reserve a spot</small>
                        </div>
                        ${chevron}
                    </button>
                </li>

                <li>
                    <button data-flow="3" class="group flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 text-left transition-all duration-200 active:scale-[0.98]">
                        <div class="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-emerald-400">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <strong class="block text-[13px] font-semibold text-slate-200">3. Payments & cancellations</strong>
                            <small class="block text-[11px] font-normal text-slate-500">How payment works</small>
                        </div>
                        ${chevron}
                    </button>
                </li>

                <li>
                    <button data-flow="4" class="group flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 text-left transition-all duration-200 active:scale-[0.98]">
                        <div class="shrink-0 rounded-lg border border-purple-500/40 bg-purple-500/15 p-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-purple-400">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <strong class="block text-[13px] font-semibold text-slate-200">4. Account & access</strong>
                            <small class="block text-[11px] font-normal text-slate-500">Login, register, owner dashboard</small>
                        </div>
                        ${chevron}
                    </button>
                </li>

                <li>
                    <button data-flow="ai" class="group flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 rounded-xl border border-purple-500/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5 hover:border-purple-500/50 hover:from-blue-500/10 hover:to-purple-500/10 text-left transition-all duration-200 active:scale-[0.98]">
                        <div class="shrink-0 rounded-lg border border-purple-500/50 bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-purple-300 ai-glow">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <strong class="block text-[13px] font-semibold text-slate-200">Talk to AI</strong>
                            <small class="block text-[11px] font-normal text-slate-500">Free chat with the assistant</small>
                        </div>
                        <span class="shrink-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">AI</span>
                    </button>
                </li>

            </ul>
        `;
        return wrap;
    }

    function resetToMenu() {
        messages.innerHTML = `
            <div class="chat-bubble bot welcome-bubble bubble-in">
                👋 Hi, I'm the <strong>PARKLY</strong> assistant.<br>
                How can I help you today?
            </div>
        `;
        messages.appendChild(buildMenu());
        hideInputArea();
        mode = "menu";
        aiHistory = [];
        setModeBadge(false);
    }

    /* ─────────────────────────────────────────
       MODE 1: QUICK REPLIES
    ───────────────────────────────────────── */
    async function runFlow(num) {
        const steps = FLOWS[num];
        if (!steps) return;

        const opts = document.getElementById("quick-options");
        if (opts) opts.remove();

        for (let i = 0; i < steps.length; i++) {
            await delay(i === 0 ? 400 : 900);
            const t = showTyping();
            await delay(800);
            t.remove();
            addBubble(steps[i].text, "bot");
        }

        await delay(900);
        const t = showTyping();
        await delay(600);