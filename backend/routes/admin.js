import express from 'express';
import { getConnection } from '../config/db.js';

const router = express.Router();

// --- ADMIN DASHBOARD ---

// Fetch high-level statistics
router.get('/stats', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [users] = await connection.execute('SELECT COUNT(*) as total FROM users');
        const [spots] = await connection.execute('SELECT COUNT(*) as total FROM parking_spots');
        res.json({ users: users[0].total, spots: spots[0].total });
    } catch (error) { 
        res.status(500).json({ error: "Stats sync failed." }); 
    } finally { if (connection) await connection.end(); }
});

// Integrated metrics (Node.js + Python service)
router.get('/metrics-all', async (req, res) => {
    try {
        const pyRes = await fetch('http://api-python:8000/metrics/full');
        if (pyRes.ok) return res.json(await pyRes.json());
    } catch (e) {
        console.warn("Python service unreachable, using Node/SQL fallback.");
    }

    // Fallback: Calculate basic metrics directly from SQL if Python service is down
    let connection;
    try {
        connection = await getConnection();
        
        // Occupancy fallback
        const [spots] = await connection.execute("SELECT COUNT(*) as count FROM parking_spots WHERE verified = 1");
        const [reserves] = await connection.execute("SELECT COUNT(*) as count FROM reservations WHERE status != 'cancelled'");
        const occupancy = spots[0].count > 0 ? (reserves[0].count / spots[0].count * 100).toFixed(1) : 0;

        // Top Spots fallback
        const [topSpots] = await connection.execute(`
            SELECT p.name, COUNT(r.id) as reservation_count
            FROM parking_spots p
            JOIN reservations r ON p.id = r.spotId
            GROUP BY p.id
            ORDER BY reservation_count DESC
            LIMIT 3
        `);

        res.json({
            occupancy_rate: parseFloat(occupancy),
            monthly_revenue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Empty revenue array to avoid frontend crash
            top_spots: topSpots,
            isFallback: true
        });
    } catch (error) {
        res.status(500).json({ error: "Metrics sync failed completely." });
    } finally {
        if (connection) await connection.end();
    }
});

// View all spots (including pending verification)
router.get('/spots', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        // Join with users table to get ownerName
        const [rows] = await connection.execute(`
            SELECT p.*, p.price_hour as price, u.name as ownerName 
            FROM parking_spots p
            LEFT JOIN users u ON p.owner_id = u.id
        `);

        // Ensure images are parsed if they exist as JSON strings
        const formatted = rows.map(s => {
            let images = [];
            try {
                if (s.images) {
                    images = typeof s.images === 'string' ? JSON.parse(s.images) : s.images;
                } else if (s.image) {
                    images = [s.image];
                }
            } catch (e) {
                console.warn(`Malformed images JSON for spot ${s.id}:`, s.images);
                images = s.image ? [s.image] : [];
            }
            return { ...s, images };
        });

        res.json(formatted);
    } catch (error) { 
        console.error("Admin spots fetch error:", error);
        res.status(500).json({ error: "Failed to fetch admin spots." }); 
    } finally { if (connection) await connection.end(); }
});

export default router;
