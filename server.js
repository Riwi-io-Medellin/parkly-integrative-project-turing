import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import cloudinary from 'cloudinary';
import multer from 'multer';
import bcrypt from 'bcryptjs'; // For password hashing
import mongoose from 'mongoose';
import crypto from 'crypto';

dotenv.config();

// EmailJS configuration (via REST API)
async function sendEmail({ to, subject, html }) {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey) {
        console.error('❌ EmailJS credentials not set in .env');
        return { error: 'Missing credentials' };
    }

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: serviceId,
                template_id: templateId,
                user_id: publicKey,
                accessToken: privateKey,
                template_params: {
                    to_email: to,
                    subject: subject,
                    message: html // Injected premium design
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`EmailJS Error: ${response.status} - ${errorText}`);
        }

        console.log(`✅ Email sent successfully to ${to}`);
        return { data: { id: 'emailjs_success' } };
    } catch (err) {
        console.error('❌ Failed to send email via EmailJS:', err.message);
        return { error: err.message };
    }
}

let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
    console.warn('⚠️ OPENAI_API_KEY not set. AI chat features will not work.');
}

// MongoDB Chat Configuration
const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
    mongoose.connect(mongoURI)
        .then(() => console.log('📦 Connected to MongoDB (Chat)'))
        .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.warn('⚠️ MONGODB_URI not set. Chat features will not work.');
}

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cloudinary configuration
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer for file uploads (memory storage for Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// EmailJS integration active

// --- Chat Message Schema (MongoDB) ---
const chatMessageSchema = new mongoose.Schema({
    reservationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderEmail: { type: String, required: true },
    receiverEmail: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306, // Default MySQL port
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : { rejectUnauthorized: true } // Allow disabling SSL for local dev
};

// Helper function to get DB connection
async function getConnection() {
    return await mysql.createConnection(dbConfig);
}

// Helper function to trigger automation webhooks (Make.com, n8n, etc.)
async function triggerAutomation(event, payload) {
    const webhookUrl = process.env.AUTOMATION_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn(`⚠️ AUTOMATION_WEBHOOK_URL not set. Event '${event}' not sent to automation.`);
        return;
    }
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, ...payload, timestamp: new Date() })
        });
        console.log(`🚀 Automation: Event '${event}' triggered.`);
    } catch (e) {
        console.error(`❌ Automation Error (${event}):`, e.message);
    }
}

// --- 1. ADMIN STATISTICS ---
app.get('/api/admin/stats', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [users] = await connection.execute('SELECT COUNT(*) as total FROM users');
        const [reservations] = await connection.execute('SELECT COUNT(*) as total FROM reservations');
        const [spots] = await connection.execute('SELECT COUNT(*) as total FROM parking_spots');
        const [pendingReservations] = await connection.execute('SELECT COUNT(*) as total FROM reservations WHERE status = "pending"');
        const [activeReservations] = await connection.execute('SELECT COUNT(*) as total FROM reservations WHERE status = "in-use"');

        console.log("Admin Dashboard: Global statistics synchronized.");
        res.json({
            users: users[0].total,
            reservations: reservations[0].total,
            spots: spots[0].total,
            pendingReservations: pendingReservations[0].total,
            activeReservations: activeReservations[0].total
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error.message);
        res.status(500).json({ error: "Failed to load administrative summary." });
    } finally {
        if (connection) await connection.end();
    }
});

// Resilient metrics calculation (Dynamic DB analytics)
app.get('/api/admin/metrics-all', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();

        const [earningsRows] = await connection.execute('SELECT SUM(total) as real_total FROM reservations WHERE status != "cancelled"');
        const real_total = (earningsRows && earningsRows[0]) ? (earningsRows[0].real_total || 0) : 0;

        let monthly_revenue = Array(12).fill(0);
        let occupancy_rate = 0;
        let topSpots = [];
        let proj_projection = 0;

        try {
            const [projRes, occRes, topRes] = await Promise.all([
                fetch('http://localhost:8000/api/python/stats/monthly-projection'),
                fetch('http://localhost:8000/api/python/stats/occupancy-rate'),
                fetch('http://localhost:8000/api/python/stats/top-spots')
            ]);

            if (projRes.ok) {
                const projData = await projRes.json();
                proj_projection = projData.projection || 0;
            }
            if (occRes.ok) {
                const occData = await occRes.json();
                occupancy_rate = occData.occupancy_rate || 0;
            }
            if (topRes.ok) {
                const topData = await topRes.json();
                topSpots = topData.top_spots || [];
            }
        } catch (pyError) {
            console.warn("Python Service Unreachable, falling back to SQL:", pyError.message);
            const [monthlyRows] = await connection.execute(`
                SELECT MONTH(date) as m, SUM(total) as t 
                FROM reservations 
                WHERE status != 'cancelled' AND YEAR(date) = YEAR(CURDATE())
                GROUP BY MONTH(date)
            `);
            monthlyRows.forEach(row => { monthly_revenue[row.m - 1] = parseFloat(row.t); });

            const [totalSpots] = await connection.execute('SELECT COUNT(*) as total FROM parking_spots WHERE verified = 1');
            const [activeRes] = await connection.execute('SELECT COUNT(*) as total FROM reservations WHERE status IN ("active", "in-use")');
            occupancy_rate = (activeRes[0].total / (totalSpots[0].total || 1)) * 100;
        }

        // Always use SQL for the historical monthly revenue array if Python doesn't provide it
        // (Python currently only provides a single projection number)
        if (monthly_revenue.every(v => v === 0)) {
            const [monthlyRows] = await connection.execute(`
                SELECT MONTH(date) as m, SUM(total) as t 
                FROM reservations 
                WHERE status != 'cancelled' AND YEAR(date) = YEAR(CURDATE())
                GROUP BY MONTH(date)
            `);
            monthlyRows.forEach(row => { monthly_revenue[row.m - 1] = parseFloat(row.t); });
        }

        const [userStats] = await connection.execute('SELECT COUNT(*) as total_users FROM users WHERE status != "deleted"');
        const total_users = userStats[0].total_users || 0;

        res.json({
            total_earnings: parseFloat(parseFloat(real_total).toFixed(2)),
            monthly_revenue: monthly_revenue,
            occupancy_rate: parseFloat(Number(occupancy_rate).toFixed(1)),
            total_users: total_users,
            top_spots: topSpots,
            projection: proj_projection
        });
    } catch (error) {
        console.error("Metrics All Error:", error.message);
        res.status(500).json({ error: "Metrics calculation failed." });
    } finally {
        if (connection) await connection.end();
    }
});


// --- WOMPI SIGNATURE GENERATOR ---
app.post('/api/wompi/signature', (req, res) => {
    const { reference, amountInCents, currency } = req.body;
    const secret = process.env.WOMPI_INTEGRITY_SECRET;

    if (!secret) {
        return res.status(500).json({ error: 'WOMPI_INTEGRITY_SECRET not configured' });
    }

    try {
        // Formula: reference + amountInCents + currency + secret
        const stringToSign = `${reference}${amountInCents}${currency}${secret}`;

        // Debug (hiding sensitive parts)
        console.log(`Signing: ${reference}${amountInCents}${currency}${secret.substring(0, 10)}...`);
        console.log(`Secret length: ${secret.length}`);

        const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');

        res.json({ signature });
    } catch (error) {
        console.error('Signature calculation error:', error);
        res.status(500).json({ error: 'Error calculating signature' });
    }
});

// --- 2. AUTHENTICATION ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(
            'SELECT id, name, email, role, phone, avatar_url, status, password FROM users WHERE email = ?',
