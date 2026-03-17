import express from 'express';
import { getConnection } from '../config/db.js';

const router = express.Router();

// --- SUPPORT & PQRS ---

// Create a new PQR (Request, Complaint, or Claim)
router.post('/', async (req, res) => {
    const { userId, type, subject, description } = req.body;
    let connection;
    try {
        connection = await getConnection();
        // Record the PQR with 'open' status
        const [result] = await connection.execute(
            'INSERT INTO pqrs (user_id, type, subject, description, status) VALUES (?, ?, ?, ?, "open")',
            [userId, type, subject, description]
        );
        res.status(201).json({ id: result.insertId, message: "PQR received. We will contact you soon." });
    } catch (error) {
        console.error("PQR registration error:", error.message);
        res.status(500).json({ error: "Could not submit PQR." });
    } finally {
        if (connection) await connection.end();
    }
});

// Fetch all PQRs (Admin view)
router.get('/', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT p.*, u.name as userName, u.email as userEmail 
            FROM pqrs p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Support sync error:", error.message);
        res.status(500).json({ error: "Failed to load PQRs." });
    } finally {
        if (connection) await connection.end();
    }
});

// Admin action: Respond to a PQR
router.patch('/:id/respond', async (req, res) => {
    const { admin_response, status } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            'UPDATE pqrs SET admin_response = ?, status = ? WHERE id = ?',
            [admin_response, status || 'resolved', req.params.id]
        );
        res.json({ message: "Response saved successfully." });
    } catch (error) {
        res.status(500).json({ error: "Failed to save response." });
    } finally {
        if (connection) await connection.end();
    }
});

export default router;
