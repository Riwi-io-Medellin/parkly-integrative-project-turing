import express from 'express';
import { getConnection } from '../config/db.js';

const router = express.Router();

// --- USER MANAGEMENT ---

// Fetch all active users
router.get('/', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT id, name, email, phone, role, status FROM users WHERE status != "deleted"');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users." });
    } finally {
        if (connection) await connection.end();
    }
});

// Get profile for a specific user ID
router.get('/:id', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (rows.length > 0) {
            const user = rows[0];
            delete user.password; // Do not expose password to frontend
            res.json(user);
        } else {
            res.status(404).json({ error: "User not found." });
        }
    } catch (error) {
        res.status(500).json({ error: "Error fetching user profile." });
    } finally {
        if (connection) await connection.end();
    }
});

// Update user profile fields
router.patch('/:id', async (req, res) => {
    const { name, phone, status, vehicle_type, license_plate } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            'UPDATE users SET name = ?, phone = ?, status = ?, vehicle_type = ?, license_plate = ? WHERE id = ?',
            [name, phone, status, vehicle_type, license_plate, req.params.id]
        );
        res.json({ message: "Profile updated successfully." });
    } catch (error) {
        res.status(500).json({ error: "Profile update failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// Admin action: Block/Unblock or update user status
router.patch('/:id/status', async (req, res) => {
    const { status } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: `User status changed to ${status}.` });
    } catch (error) {
        res.status(500).json({ error: "Failed to update status." });
    } finally {
        if (connection) await connection.end();
    }
});

// --- FAVORITES ---

// Get list of favorite spot IDs for a user
router.get('/:userId/favorites', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT spot_id FROM favorites WHERE user_id = ?', [req.params.userId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to load favorites." });
    } finally {
        if (connection) await connection.end();
    }
});

// Add a spot to user's favorites
router.post('/:userId/favorites', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        // INSERT IGNORE prevents error if already favorited
        await connection.execute('INSERT IGNORE INTO favorites (user_id, spot_id) VALUES (?, ?)', [req.params.userId, req.body.spotId]);
        res.json({ message: "Added to favorites." });
    } catch (error) {
        res.status(500).json({ error: "Failed to add favorite." });
    } finally {
        if (connection) await connection.end();
    }
});

// Remove a spot from favorites
router.delete('/:userId/favorites/:spotId', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        await connection.execute('DELETE FROM favorites WHERE user_id = ? AND spot_id = ?', [req.params.userId, req.params.spotId]);
        res.json({ message: "Removed from favorites." });
    } catch (error) {
        res.status(500).json({ error: "Failed to remove favorite." });
    } finally {
        if (connection) await connection.end();
    }
});

// --- OWNER SPECIFIC ---

// Fetch all spots owned by a specific user
router.get('/:userId/spots', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM parking_spots WHERE owner_id = ? AND deleted_at IS NULL', [req.params.userId]);
        
        // Parse images JSON string to array for each spot
        const parsedRows = rows.map(r => {
            try { r.images = r.images ? JSON.parse(r.images) : []; } catch (e) { r.images = []; }
            return r;
        });
        res.json(parsedRows);
    } catch (error) {
        console.error("Error fetching owner spots:", error.message);
        res.status(500).json({ error: "Failed to fetch your spots." });
    } finally {
        if (connection) await connection.end();
    }
});

export default router;
