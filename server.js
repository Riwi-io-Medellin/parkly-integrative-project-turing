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
            [email]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials. Access denied." });
        }

        const user = rows[0];

        // Check if account is suspended/deleted
        if (user.status === 'suspended') {
            return res.status(403).json({ error: "Account suspended. Contact support." });
        }
        if (user.status === 'deleted') {
            return res.status(403).json({ error: "Account not found." });
        }

        // Try bcrypt first, then fall back to plain text (for old test users)
        let isValid = false;
        const isBcrypt = user.password && user.password.startsWith('$2');
        if (isBcrypt) {
            isValid = await bcrypt.compare(password, user.password);
        } else {
            // Plain text comparison (old test users)
            isValid = (password === user.password);
            // Auto-upgrade to bcrypt if correct
            if (isValid) {
                const hashed = await bcrypt.hash(password, 10);
                await connection.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
                console.log(`Password upgraded to bcrypt for user: ${email}`);
            }
        }

        if (!isValid) {
            return res.status(401).json({ error: "Invalid credentials. Access denied." });
        }

        delete user.password;
        console.log(`Access granted: ${email} (role: ${user.role})`);
        res.json(user);

    } catch (error) {
        console.error("Auth Error:", error.message);
        res.status(500).json({ error: "Authentication service unavailable." });
    } finally {
        if (connection) await connection.end();
    }
});

// Request password reset (forgot-password)
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT id, name FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            // We return 200 even if user doesn't exist for security (don't reveal email existence)
            return res.json({ message: "If an account exists with this email, a reset link has been sent." });
        }

        const user = rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        await connection.execute(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [token, expires, user.id]
        );

        // Send email
        const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;
        await sendEmail({
            to: email,
            subject: '🔑 Reset your PARKLY password',
            html: `                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                    <div style="background-color: #3b82f6; padding: 30px; text-align: center;">
                        <span style="color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -1px;">PARK<span style="color: #dbeafe;">LY</span></span>
                    </div>
                    <div style="padding: 40px 30px;">
                        <h2 style="color: #111827; margin-top: 0; font-size: 22px;">🔑 Reset your Password</h2>
                        <p style="font-size: 16px; line-height: 24px; color: #4b5563;">Hello ${user.name || 'User'},</p>
                        <p style="font-size: 16px; line-height: 24px; color: #4b5563;">We received a request to reset your password. Click the button below to choose a new one. This link will expire in 1 hour.</p>
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${resetLink}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);">Reset Password</a>
                        </div>
                        <p style="font-size: 14px; color: #9ca3af; margin-bottom: 0;">If you didn't request this, you can safely ignore this email.</p>
                    </div>
                    <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="font-size: 13px; color: #6b7280; margin: 0;">© 2024 Parkly. The smartest way to park.</p>
                    </div>
                </div>
            `
        });

        res.json({ message: "If an account exists with this email, a reset link has been sent." });
    } catch (error) {
        console.error("Forgot Password Error:", error.message);
        res.status(500).json({ error: "Failed to process request." });
    } finally {
        if (connection) await connection.end();
    }
});

// Reset password with token
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(
            'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: "Invalid or expired token." });
        }

        const userId = rows[0].id;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hashedPassword, userId]
        );

        res.json({ message: "Password updated successfully! You can now log in." });
    } catch (error) {
        console.error("Reset Password Error:", error.message);
        res.status(500).json({ error: "Failed to reset password." });
    } finally {
        if (connection) await connection.end();
    }
});

// --- 3. USER MANAGEMENT ---
// Register new user
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, role = 'user' } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const hashedPassword = await bcrypt.hash(password, 10); // Hash password
        const [result] = await connection.execute(
            'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone, role]
        );
        console.log(`New user registered: ${email}`);
        
        // Send Welcome Email
        try {
            await sendEmail({
                to: email,
                subject: '🚀 Welcome to Parkly!',
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                        <div style="background-color: #3b82f6; padding: 30px; text-align: center;">
                            <span style="color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -1px;">PARK<span style="color: #dbeafe;">LY</span></span>
                        </div>
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #111827; margin-top: 0; font-size: 24px;">🚀 Welcome to the family!</h2>
                            <p style="font-size: 16px; color: #4b5563;">Hello <b>${name}</b>,</p>
                            <p style="font-size: 16px; color: #4b5563;">Thank you for joining Parkly. We're excited to help you find the best parking spots or help you earn money with yours.</p>
                            
                            <div style="background-color: #f3f4f6; border-radius: 10px; padding: 25px; margin: 30px 0;">
                                <h3 style="margin-top: 0; font-size: 18px; color: #111827;">What's next?</h3>
                                <ul style="padding-left: 20px; color: #4b5563; line-height: 1.6;">
                                    <li><b>Find Parking:</b> Use our interactive map to find spots near you.</li>
                                    <li><b>Book instantly:</b> Pay securely and save your spot.</li>
                                    <li><b>List your spot:</b> Start earning by renting your empty garage.</li>
                                </ul>
                            </div>

                            <div style="text-align: center; margin: 35px 0;">
                                <a href="http://localhost:3000" style="background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);">Start Exploring</a>
                            </div>
                            
                            <p style="font-size: 16px; color: #4b5563;">If you have any questions, just reply to this email. We're here to help!</p>
                        </div>
                        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="font-size: 13px; color: #6b7280; margin: 0;">© 2024 Parkly. Urban parking made simple.</p>
                        </div>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error("Welcome Email Error:", emailErr.message);
        }

        res.status(201).json({ id: result.insertId, name, email, phone, role });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: "Email already registered." });
        }
        console.error("User Registration Error:", error.message);
        res.status(500).json({ error: "Failed to register user." });
    } finally {
        if (connection) await connection.end();
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(
            'SELECT id, name, email, phone, role, avatar_url, status FROM users WHERE status != "deleted" OR status IS NULL'
        );
        res.json(rows);
    } catch (error) {
        console.error("Fetch Users Error:", error.message);
        res.status(500).json({ error: "Failed to retrieve users." });
    } finally {
        if (connection) await connection.end();
    }
});

// Google Auth Sync (from Firebase)
app.post('/api/auth/google', async (req, res) => {
    const { name, email, photo, role } = req.body;
    let connection;
    try {
        connection = await getConnection();
        // 1. Check if user exists
        const [rows] = await connection.execute(
            'SELECT id, name, email, role, phone, avatar_url, status FROM users WHERE email = ?',
            [email]
        );

        let user;
        if (rows.length > 0) {
            user = rows[0];
            if (user.status === 'suspended' || user.status === 'deleted') {
                return res.status(403).json({ error: "Account suspended or deleted." });
            }
            // Update avatar if we have a new photo and none exists
            if (photo && !user.avatar_url) {
                await connection.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [photo, user.id]);
                user.avatar_url = photo;
            }
            console.log(`Google Login: Existing user ${email}`);
        } else {
            // 2. Create new user
            const [result] = await connection.execute(
                'INSERT INTO users (name, email, role, avatar_url, password) VALUES (?, ?, ?, ?, ?)',
                [name || 'Google User', email, role || 'client', photo, 'GOOGLE_AUTH']
            );
            user = {
                id: result.insertId,
                name: name || 'Google User',
                email: email,
                role: role || 'client',
                avatar_url: photo,
                status: 'active'
            };
            console.log(`Google Login: Created new user ${email}`);
        }
        res.json(user);
    } catch (error) {
        console.error("Google Auth Sync Error:", error.message);
        res.status(500).json({ error: "Failed to synchronize Google login." });
    } finally {
        if (connection) await connection.end();
    }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(
            'SELECT id, name, email, phone, role, photo, avatar_url, status, vehicle_type, license_plate FROM users WHERE id = ?',
            [id]
        );
        if (rows.length > 0) {
            const u = rows[0];
            // Normalize: if no avatar_url but has photo (Google OAuth), use photo
            if (!u.avatar_url && u.photo) u.avatar_url = u.photo;
            res.json(u);
        } else {
            res.status(404).json({ error: "User not found." });
        }
    } catch (error) {
        console.error("Fetch User by ID Error:", error.message);
        res.status(500).json({ error: "Failed to retrieve user." });
    } finally {
        if (connection) await connection.end();
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, role, password } = req.body;
    let connection;
    try {
        connection = await getConnection();
        let updateFields = [];
        let updateValues = [];

        if (name) { updateFields.push('name = ?'); updateValues.push(name); }
        if (email) { updateFields.push('email = ?'); updateValues.push(email); }
        if (phone) { updateFields.push('phone = ?'); updateValues.push(phone); }
        if (role) { updateFields.push('role = ?'); updateValues.push(role); }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?'); updateValues.push(hashedPassword);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: "No fields to update." });
        }

        updateValues.push(id);
        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        const [result] = await connection.execute(query, updateValues);

        if (result.affectedRows > 0) {
            console.log(`User ${id} updated.`);
            res.json({ message: "User updated successfully." });
        } else {
            res.status(404).json({ error: "User not found or no changes made." });
        }
    } catch (error) {
        console.error("Update User Error:", error.message);
        res.status(500).json({ error: "Failed to update user." });
    } finally {
        if (connection) await connection.end();
    }
});

// Partial update user (PATCH) — used by profile.js
app.patch('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, avatar_url, status, password, vehicle_type, license_plate } = req.body;
    let connection;
    try {
        connection = await getConnection();
        let updateFields = [];
        let updateValues = [];

        if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name); }
        if (phone !== undefined) { updateFields.push('phone = ?'); updateValues.push(phone); }
        if (avatar_url !== undefined) {
            updateFields.push('avatar_url = ?'); updateValues.push(avatar_url);
            // Also update legacy 'photo' column for consistency with Google OAuth
            updateFields.push('photo = ?'); updateValues.push(avatar_url);
        }
        if (status !== undefined) { updateFields.push('status = ?'); updateValues.push(status); }
        if (vehicle_type !== undefined) { updateFields.push('vehicle_type = ?'); updateValues.push(vehicle_type); }
        if (license_plate !== undefined) { updateFields.push('license_plate = ?'); updateValues.push(license_plate); }
        if (password) {
            const hashed = await bcrypt.hash(password, 10);
            updateFields.push('password = ?'); updateValues.push(hashed);
        }

        if (updateFields.length === 0) return res.status(400).json({ error: "No fields to update." });

        updateValues.push(id);
        const [result] = await connection.execute(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        if (result.affectedRows > 0) {
            const [rows] = await connection.execute('SELECT id, name, email, phone, role, photo, avatar_url, status, vehicle_type, license_plate FROM users WHERE id = ?', [id]);
            const u = rows[0] || {};
            if (!u.avatar_url && u.photo) u.avatar_url = u.photo;
            res.json(u);
        } else {
            res.status(404).json({ error: "User not found." });
        }
    } catch (error) {
        console.error("Patch User Error:", error.message);
        res.status(500).json({ error: "Failed to update user." });
    } finally {
        if (connection) await connection.end();
    }
});

// Also support the /status suffix that profile.js uses
app.patch('/api/users/:id/status', async (req, res) => {
    req.url = `/api/users/${req.params.id}`;
    // Delegate to the same handler — just forward the same body
    const { name, phone, avatar_url, status, password } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const fields = [];
        const vals = [];
        if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
        if (phone !== undefined) { fields.push('phone = ?'); vals.push(phone); }
        if (avatar_url !== undefined) { fields.push('avatar_url = ?'); vals.push(avatar_url); }
        if (status !== undefined) { fields.push('status = ?'); vals.push(status); }
        if (!fields.length) return res.status(400).json({ error: "Nothing to update." });
        vals.push(req.params.id);
        await connection.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
        res.json({ message: "Updated." });
    } catch (e) {
        console.error("Patch /status Error:", e.message);
        res.status(500).json({ error: "Update failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            console.log(`User ${id} deleted.`);
            res.json({ message: "User deleted successfully." });
        } else {
            res.status(404).json({ error: "User not found." });
        }
    } catch (error) {
        console.error("Delete User Error:", error.message);
        res.status(500).json({ error: "Failed to delete user." });
    } finally {
        if (connection) await connection.end();
    }
});

// --- 4. PARKING SPOTS (parking_spots — tabla original con datos reales) ---
app.get('/api/spots', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT
                ps.id, ps.name, ps.address, ps.zone,
                ps.price_hour AS price, ps.price_day, ps.price_month,
                ps.image, ps.images, ps.schedule, ps.services AS features,
                ps.dimensions, ps.whatsapp, ps.rating,
                ps.owner_id AS ownerId,
                ps.verified,
                ps.available AS status,
                ps.vehicle_types, ps.max_width, ps.max_length, ps.max_height,
                u.name AS ownerName
            FROM parking_spots ps
            LEFT JOIN users u ON ps.owner_id = u.id
            WHERE ps.deleted_at IS NULL AND ps.available = 1
        `);

        const parsedRows = rows.map(r => {
            try {
                r.images = r.images ? JSON.parse(r.images) : (r.image ? [r.image] : []);
            } catch (e) {
                r.images = [r.image];
            }
            return r;
        });

        res.json(parsedRows);
    } catch (error) {
        console.error("Load Spots Error:", error.message);
        res.status(500).json({ error: "Unable to retrieve parking spot data." });
    } finally {
        if (connection) await connection.end();
    }
});

// Admin: all spots including pending (available=0) and rejected (available=-1)
app.get('/api/admin/spots', async (_req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT
                ps.id, ps.name, ps.address, ps.zone,
                ps.price_hour AS price, ps.image, ps.images, ps.schedule,
                ps.services AS features, ps.dimensions, ps.rating,
                ps.owner_id AS ownerId, ps.verified,
