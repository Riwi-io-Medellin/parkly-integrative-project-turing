import express from 'express';
import { getConnection, ChatMessage } from '../config/db.js';
import openai from '../config/openai.js';

const router = express.Router();

// --- CHAT SYSTEM (MongoDB) ---

// Send a new chat message
router.post('/chat', async (req, res) => {
    try {
        const msg = new ChatMessage(req.body);
        await msg.save();
        res.status(201).json(msg);
    } catch (error) { 
        console.error("Chat save error:", error.message);
        res.status(500).json({ error: "Failed to send message." }); 
    }
});

// Fetch chat history for a specific reservation
router.get('/chat/:resId', async (req, res) => {
    try {
        const msgs = await ChatMessage.find({ reservationId: req.params.resId }).sort({ createdAt: 1 });
        res.json(msgs);
    } catch (error) { 
        console.error("Chat sync error:", error.message);
        res.status(500).json({ error: "Could not load messages." }); 
    }
});

// --- AI ASSISTANT ---

// Handle AI chat requests
router.post('/ai-chat', async (req, res) => {
    if (!openai) return res.status(503).json({ error: "IA service not available." });
    
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: req.body.message }]
        });
        res.json({ reply: completion.choices[0].message.content });
    } catch (error) { 
        console.error("AI Assistant error:", error.message);
        res.status(500).json({ error: "AI failed to respond." }); 
    }
});

export default router;
