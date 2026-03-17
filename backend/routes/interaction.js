import express from 'express';
import { getConnection } from '../config/db.js';

const router = express.Router();

// --- USER REVIEWS ---

// Submit a review for a parking spot or user
router.post('/reviews', async (req, res) => {
    const { reservation_id, reviewer_id, reviewer_role, reviewed_type, reviewed_id, rating, comment } = req.body;
    let connection;
    try {
        connection = await getConnection();
        // Get reviewer's email for identification
        const [users] = await connection.execute('SELECT email FROM users WHERE id = ?', [reviewer_id]);
        const userEmail = users[0]?.email;

        // Save review record
        await connection.execute(
            'INSERT INTO reviews (reservationId, spotId, userEmail, authorRole, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
            [reservation_id, reviewed_id, userEmail, reviewer_role, rating, comment]
        );

        // Update spot's average rating
        if (reviewed_type === 'spot') {
            await connection.execute(
                'UPDATE parking_spots SET rating = (SELECT AVG(rating) FROM reviews WHERE spotId = ?) WHERE id = ?',
                [reviewed_id, reviewed_id]
            );
        }
        res.status(201).json({ message: "Thanks for your review!" });
    } catch (error) { 
        console.error("Review error:", error.message);
        res.status(500).json({ error: "Failed to save review." }); 
    } finally { if (connection) await connection.end(); }
});

// Get reviews for a specific spot
router.get('/reviews/spot/:spotId', async (req, res) => {
    const { spotId } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT r.*, u.name as reviewer_name 
            FROM reviews r
            LEFT JOIN users u ON r.userEmail = u.email
            WHERE r.spotId = ?
            ORDER BY r.createdAt DESC
        `, [spotId]);
        res.json(rows);
    } catch (error) {
        console.error("Fetch reviews error:", error.message);
        res.status(500).json({ error: "Failed to load reviews." });
    } finally { if (connection) await connection.end(); }
});

// --- WAITLIST ---

// Add user to waitlist for a full parking spot
router.post('/waitlist', async (req, res) => {
    const { userId, parkingId, requestedTime } = req.body;
    let connection;
    try {
        connection = await getConnection();
        // Insert record with 'pending' status
        await connection.execute(
            'INSERT INTO waitlist (user_id, parking_id, requested_time, status) VALUES (?, ?, ?, "pending")',
            [userId, parkingId, requestedTime]
        );
        res.status(201).json({ message: "Added to waitlist." });
    } catch (error) { 
        console.error("Waitlist error:", error.message);
        res.status(500).json({ error: "Waitlist request failed." }); 
    } finally { if (connection) await connection.end(); }
});

export default router;
