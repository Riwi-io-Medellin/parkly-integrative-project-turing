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
    const modeBadge  = document.getElementById("mode-badge");