import express from 'express';
const router = express.Router();

// Endpoint to provide the Google Maps API key to the frontend
router.get('/maps-key', (req, res) => {
    res.json({ key: process.env.GOOGLE_MAPS_API_KEY });
});

export default router;
