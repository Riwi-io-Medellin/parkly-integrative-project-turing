import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { getConnection } from '../config/db.js';

const router = express.Router();
// Use memory storage for temporary file processing before upload
const upload = multer({ storage: multer.memoryStorage() });

// --- PARKING SPOT MANAGEMENT ---

// View verified spots
router.get('/', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        // Join with users table to get the owner's name
        const [rows] = await connection.execute(`
            SELECT p.*, p.price_hour as price, u.name as ownerName 
            FROM parking_spots p 
            JOIN users u ON p.owner_id = u.id 
            WHERE p.available = 1
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
        console.error("Error listing spots:", error.message);
        res.status(500).json({ error: "Failed to fetch spots." }); 
    } finally { if (connection) await connection.end(); }
});

// Get details for a single spot ID
router.get('/:id', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT p.*, p.price_hour as price, u.name as ownerName 
            FROM parking_spots p 
            JOIN users u ON p.owner_id = u.id 
            WHERE p.id = ?
        `, [req.params.id]);

        if (rows.length > 0) {
            const spot = rows[0];
            // Ensure images are parsed if they exist as JSON strings
            try {
                if (spot.images) {
                    spot.images = typeof spot.images === 'string' ? JSON.parse(spot.images) : spot.images;
                } else if (spot.image) {
                    spot.images = [spot.image];
                } else {
                    spot.images = [];
                }
            } catch (e) {
                console.warn(`Malformed images JSON for spot ${spot.id}:`, spot.images);
                spot.images = spot.image ? [spot.image] : [];
            }
            res.json(spot);
        } else {
            res.status(404).json({ error: "Spot not found." });
        }
    } catch (error) {
        console.error("Error fetching spot details:", error.message);
        res.status(500).json({ error: "Error fetching spot details." });
    } finally {
        if (connection) await connection.end();
    }
});

// --- ADMIN ACTIONS ---

// Verify and approve a parking spot for public display
router.patch('/:id/approve', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        await connection.execute('UPDATE parking_spots SET available = 1, verified = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: "Spot approved and now live." });
    } catch (error) {
        res.status(500).json({ error: "Approval failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// Reject a parking spot request
router.patch('/:id/reject', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        // Setting available to -1 for rejection
        await connection.execute('UPDATE parking_spots SET available = -1, verified = 0 WHERE id = ?', [req.params.id]);
        res.json({ message: "Spot request rejected." });
    } catch (error) {
        res.status(500).json({ error: "Rejection failed." });
    } finally {
        if (connection) await connection.end();
    }
});

// --- REQUESTS FOR NEW SPOTS ---

// Unified spot submission (handles both / and /request)
router.post(['/', '/request'], upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'certificate', maxCount: 1 }
]), async (req, res) => {
    // Collect possible field names for dimensions/cells
    const dimensionsInput = req.body.dimensions || req.body.cells;

    const { name, address, price, ownerId, zone, schedule, features, vehicle_types, max_width, max_length, max_height } = req.body;
    let connection;
    try {
        connection = await getConnection();

        // Process photos
        const imageUrls = [];
        if (req.files && req.files.photos) {
            for (const file of req.files.photos) {
                const result = await cloudinary.v2.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    { folder: 'parkly_spots' }
                );
                imageUrls.push(result.secure_url);
            }
        }

        // Process certificate if exists
        let certUrl = null;
        if (req.files && req.files.certificate) {
            const certFile = req.files.certificate[0];
            const result = await cloudinary.v2.uploader.upload(
                `data:${certFile.mimetype};base64,${certFile.buffer.toString('base64')}`,
                { folder: 'parkly_certs' }
            );
            certUrl = result.secure_url;
        }

        const imagesJson = JSON.stringify(imageUrls);
        const mainImage = imageUrls.length > 0 ? imageUrls[0] : null;

        // Parse numeric fields to avoid SQL errors with empty strings
        const pOwnerId = parseInt(ownerId);
        if (isNaN(pOwnerId) || pOwnerId <= 0) {
            console.error("Invalid ownerId received:", ownerId);
            return res.status(400).json({ error: "Invalid or missing owner ID. Please log in again." });
        }
        const pPrice = parseFloat(price) || 0;
        const pMaxWidth = max_width ? parseFloat(max_width) : null;
        const pMaxLength = max_length ? parseFloat(max_length) : null;
        const pMaxHeight = max_height ? parseFloat(max_height) : null;

        await connection.execute(
            `INSERT INTO parking_spots 
            (name, address, price_hour, owner_id, available, image, images, zone, dimensions, schedule, services, vehicle_types, max_width, max_length, max_height) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, address, pPrice, pOwnerId, 0, mainImage, imagesJson, zone, dimensionsInput || '', schedule, features, vehicle_types, pMaxWidth, pMaxLength, pMaxHeight]
        );

        res.status(201).json({ message: "Spot request submitted for admin approval." });
    } catch (error) {
        console.error("Error saving spot request:", error);
        res.status(500).json({ error: "Submission failed." });
    } finally { if (connection) await connection.end(); }
});

// Update an existing parking spot (PUT)
router.put('/:id', upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'certificate', maxCount: 1 }
]), async (req, res) => {
    const { id } = req.params;
    const { name, address, zone, price, cells, schedule, features, vehicle_types, existingImages } = req.body;
    let connection;
    try {
        connection = await getConnection();
        
        // Handle new images if provided
        let updatedImages = [];
        if (existingImages) {
            try { updatedImages = JSON.parse(existingImages); } catch (e) { updatedImages = []; }
        }

        if (req.files && req.files.photos) {
            for (const file of req.files.photos) {
                const result = await cloudinary.v2.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    { folder: 'parkly_spots' }
                );
                updatedImages.push(result.secure_url);
            }
        }

        // Process certificate if exists
        let certUrl = null;
        if (req.files && req.files.certificate) {
            const certFile = req.files.certificate[0];
            const result = await cloudinary.v2.uploader.upload(
                `data:${certFile.mimetype};base64,${certFile.buffer.toString('base64')}`,
                { folder: 'parkly_certs' }
            );
            certUrl = result.secure_url;
        }

        const images_json = JSON.stringify(updatedImages);
        const primary_image = updatedImages[0] || '';

        await connection.execute(
            `UPDATE parking_spots 
             SET name = ?, address = ?, zone = ?, price_hour = ?, dimensions = ?, 
                 schedule = ?, services = ?, vehicle_types = ?, 
                 image = ?, images = ? 
             WHERE id = ?`,
            [name, address, zone, price, cells, schedule, features, vehicle_types, primary_image, images_json, id]
        );

        res.json({ message: "Spot updated successfully." });
    } catch (error) {
        console.error("Error updating spot:", error.message);
        res.status(500).json({ error: "Failed to update spot." });
    } finally {
        if (connection) await connection.end();
    }
});

// Delete a parking spot (Soft Delete)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        // We use soft delete by setting available to -1 or a deleted flag if schema supports it
        // Based on previous logs, 'available = -1' or a 'deleted_at' column is common
        await connection.execute('UPDATE parking_spots SET available = -1, deleted_at = NOW() WHERE id = ?', [id]);
        res.json({ message: "Spot deleted successfully." });
    } catch (error) {
        console.error("Error deleting spot:", error.message);
        res.status(500).json({ error: "Failed to delete spot." });
    } finally {
        if (connection) await connection.end();
    }
});

export default router;
