import express from 'express';
import { getConnection } from '../config/db.js';

const router = express.Router();

// Export all reservations as CSV
router.get('/reservations', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM reservations ORDER BY createdAt DESC');
        
        if (rows.length === 0) {
            return res.status(404).send('No data to export.');
        }

        const headers = Object.keys(rows[0]).join(',');
        const csvContent = [
            headers,
            ...rows.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=parkly-reservations.csv');
        res.status(200).send(csvContent);
    } catch (error) {
        console.error("Export error:", error.message);
        res.status(500).send("Failed to export CSV.");
    } finally {
        if (connection) await connection.end();
    }
});

export default router;
