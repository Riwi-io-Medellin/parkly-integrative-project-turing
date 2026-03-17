import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import modular routes from the backend directory
import authRoutes from './backend/routes/auth.js';
import userRoutes from './backend/routes/users.js';
import spotRoutes from './backend/routes/spots.js';
import reservationRoutes from './backend/routes/reservations.js';
import adminRoutes from './backend/routes/admin.js';
import supportRoutes from './backend/routes/support.js';
import paymentRoutes from './backend/routes/payment.js';
import socialRoutes from './backend/routes/social.js';
import interactionRoutes from './backend/routes/interaction.js';
import exportRoutes from './backend/routes/export.js';
import configRoutes from './backend/routes/config.js';

// Setup file path and directory aliases
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();

// Middlewares: Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- API ROUTE MAPPING ---

// Mount shared endpoints on /api root
app.use('/api', authRoutes);
app.use('/api', socialRoutes);
app.use('/api', interactionRoutes);

// Mount specific resource endpoints
app.use('/api/users', userRoutes);
app.use('/api/spots', spotRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pqr', supportRoutes);
app.use('/api/config', configRoutes);
app.use('/api/wompi', paymentRoutes);

// --- CATCH-ALL ROUTE ---

// Redirect all non-API requests to the frontend index.html
app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'API route not found' });
    }
});

// Start the server on configured port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('------------------------------------------');
    console.log('       PARKLY SERVER STARTED              ');
    console.log(`   Listening at: http://localhost:${PORT}`);
    console.log('------------------------------------------');
});