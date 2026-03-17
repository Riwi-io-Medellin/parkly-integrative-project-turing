import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// --- PAYMENT INTEGRATION (Wompi) ---

// Generate a digital signature requested by Wompi to secure transactions
router.post('/signature', (req, res) => {
    const { reference, amountInCents, currency } = req.body;
    
    // Retrieve secret integrity key from .env (never expose to public)
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    
    if (!integritySecret) {
        return res.status(500).json({ error: "Wompi service not configured on server." });
    }

    // Concatenate parameters as required by Wompi's documentation
    const rawString = `${reference}${amountInCents}${currency}${integritySecret}`;
    
    // Generate SHA-256 hash to create the unique signature
    const hash = crypto.createHash('sha256').update(rawString).digest('hex');
    
    res.json({ signature: hash });
});

export default router;
