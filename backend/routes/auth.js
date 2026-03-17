import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getConnection } from '../config/db.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

// --- AUTHENTICATION ROUTES ---

// User login endpoint
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    let connection;
    try {
        connection = await getConnection();
        // Look for the user in the database by email
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length === 0) return res.status(401).json({ error: "User not found." });
        
        const user = rows[0];
        // Check if the account is suspended
        if (user.status === 'suspended') return res.status(403).json({ error: "Account suspended." });
        
        // Compare provided password with hashed password in DB
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: "Invalid password." });
        
        // Remove password before sending user data back
        delete user.password;
        res.json(user);
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({ error: "Internal server error." });
    } finally {
        if (connection) await connection.end();
    }
});

// User registration endpoint
router.post('/register', async (req, res) => {
    const { name, email, password, phone, role = 'user' } = req.body;
    let connection;
    try {
        connection = await getConnection();
        // Hash password for security
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await connection.execute(
            'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone, role]
        );
        
        // Send welcome email
        await sendEmail({
            to: email,
            subject: '🚀 Welcome to Parkly!',
            html: `<h2>Hi ${name}!</h2><p>Thanks for joining Parkly.</p>`
        });

        res.status(201).json({ id: result.insertId, name, email });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Email already registered." });
        console.error("Registration error:", error.message);
        res.status(500).json({ error: "Registration failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// Request password reset token
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT id, name FROM users WHERE email = ?', [email]);
        
        if (rows.length === 0) return res.json({ message: "Instructions sent if email exists." });
        
        const user = rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // Token expires in 1 hour

        await connection.execute(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [token, expires, user.id]
        );

        const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;
        await sendEmail({
            to: email,
            subject: '🔑 Recover your Parkly access',
            html: `<p>Hi ${user.name}, use this link to reset your password: <a href="${resetLink}">Reset Password</a></p>`
        });

        res.json({ message: "Instructions sent if email exists." });
    } catch (error) {
        res.status(500).json({ error: "Error processing request." });
    } finally {
        if (connection) await connection.end();
    }
});

// Reset password using token
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const [result] = await connection.execute(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE reset_token = ? AND reset_token_expires > NOW()',
            [hashedPassword, token]
        );

        if (result.affectedRows === 0) return res.status(400).json({ error: "Invalid or expired token." });

        res.json({ message: "Password updated successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Password reset failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// Google Authentication endpoint
router.post('/auth/google', async (req, res) => {
    const { name, email, photo, role } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            const [result] = await connection.execute(
                'INSERT INTO users (name, email, role, avatar_url, password) VALUES (?, ?, ?, ?, "GOOGLE_AUTH")',
                [name, email, role || 'client', photo]
            );
            res.json({ id: result.insertId, name, email, role: role || 'client', avatar_url: photo });
        }
    } catch (error) {
        res.status(500).json({ error: "Google auth failed." });
    } finally {
        if (connection) await connection.end();
    }
});

export default router;
