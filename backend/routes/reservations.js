import express from 'express';
import { getConnection } from '../config/db.js';
import { sendEmail } from '../services/email.js';
import { triggerAutomation } from '../services/automation.js';

const router = express.Router();

// --- RESERVATION ROUTES ---

// Fetch all reservations (Admin view)
router.get('/', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT 
                r.id, r.spotId, r.userId, r.userName, r.userEmail,
                r.spotName, r.date, r.startTime, r.endTime,
                r.total, r.status, r.carPlate, r.ownerId,
                r.completed_at, r.createdAt, r.payment_method,
                s.address, s.image
            FROM reservations r
            LEFT JOIN parking_spots s ON r.spotId = s.id
            ORDER BY r.date DESC, r.startTime DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching reservations:", error.message);
        res.status(500).json({ error: "Failed to sync reservation data." });
    } finally {
        if (connection) await connection.end();
    }
});

// Fetch reservations for a specific user
router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT 
                r.id, r.spotId, r.userId, r.userName, r.userEmail,
                r.spotName, r.date, r.startTime, r.endTime,
                r.total, r.status, r.carPlate, r.ownerId,
                s.address, s.image
            FROM reservations r
            LEFT JOIN parking_spots s ON r.spotId = s.id
            WHERE r.userId = ? OR LOWER(r.userEmail) = LOWER(?)
            ORDER BY r.date DESC, r.startTime DESC
        `, [userId, userId]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching user reservations:", error.message);
        res.status(500).json({ error: "Could not retrieve your bookings." });
    } finally {
        if (connection) await connection.end();
    }
});

// Create a new booking
router.post('/', async (req, res) => {
    const { id, userId, userName, userEmail, spotId, spotName, ownerId, date, startTime, endTime, total, carPlate } = req.body;
    let connection;
    try {
        connection = await getConnection();
        // Check for schedule conflicts at the requested spot
        const [conflicts] = await connection.execute(
            `SELECT id FROM reservations 
             WHERE spotId = ? AND date = ? 
             AND (startTime < ? AND endTime > ?)
             AND status IN ('pending', 'active', 'in-use')`,
            [spotId, date, endTime, startTime]
        );
        if (conflicts.length > 0) {
            return res.status(409).json({ error: "Spot already booked for this time." });
        }

        const resId = id || `res_${Date.now()}`;
        await connection.execute(
            `INSERT INTO reservations 
             (id, userId, userName, userEmail, spotId, spotName, ownerId, date, startTime, endTime, total, carPlate, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [resId, userId || '', userName || '', userEmail || '', spotId || 0, spotName || '', ownerId || '',
                date, startTime, endTime, total || 0, carPlate || '']
        );

        // Send confirmation email
        if (userEmail) {
            try {
                await sendEmail({
                    to: userEmail,
                    subject: '✅ Your Parkly booking is ready!',
                    html: `<div><h2>Booking Confirmed!</h2><p>Your spot at <b>${spotName}</b> is reserved for ${date}.</p></div>`
                });
            } catch (emailErr) {
                console.error('Failed to send confirmation email:', emailErr.message);
            }
        }

        // Trigger external automation
        triggerAutomation('reservation_created', { 
            id: resId, userName, spotName, date, startTime, endTime, total 
        });

        res.status(201).json({ id: resId, message: "Booking created successfully." });
    } catch (error) {
        console.error("Error creating booking:", error.message);
        res.status(500).json({ error: "Booking failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// Update booking status
router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute('UPDATE reservations SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows > 0) {
            res.json({ message: `Status updated to ${status}.` });
        } else {
            res.status(404).json({ error: "Booking not found." });
        }
    } catch (error) {
        console.error("Error updating status:", error.message);
        res.status(500).json({ error: "Failed to update status." });
    } finally {
        if (connection) await connection.end();
    }
});

// Record user arrival at the spot
router.patch('/:id/arrive', async (req, res) => {
    const { id } = req.params;
    const { licensePlate } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute(
            'UPDATE reservations SET status = "in-use", license_plate = COALESCE(?, license_plate) WHERE id = ? AND status = "pending"',
            [licensePlate, id]
        );
        if (result.affectedRows > 0) {
            res.json({ message: "Arrival recorded successfully." });
        } else {
            res.status(404).json({ error: "Could not record arrival." });
        }
    } catch (error) {
        console.error("Arrival error:", error.message);
        res.status(500).json({ error: "Error during arrival recording." });
    } finally {
        if (connection) await connection.end();
    }
});

// Cancel a reservation
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute('UPDATE reservations SET status = "cancelled" WHERE id = ? AND status IN ("pending", "in-use", "active")', [id]);
        if (result.affectedRows > 0) {
            res.json({ message: "Booking cancelled successfully." });
        } else {
            res.status(404).json({ error: "Booking not found or cannot be cancelled." });
        }
    } catch (error) {
        console.error("Cancellation error:", error.message);
        res.status(500).json({ error: "Cancellation failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// Admin action: Cancel with reason
router.patch('/:id/cancel', async (req, res) => {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            'UPDATE reservations SET status = "cancelled", cancel_reason = ? WHERE id = ?',
            [cancel_reason || 'Cancelled by administrator', id]
        );
        res.json({ message: "Reservation cancelled with reason." });
    } catch (error) {
        res.status(500).json({ error: "Cancellation failed." });
    } finally {
        if (connection) await connection.end();
    }
});

export default router;
