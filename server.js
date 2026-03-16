import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import cloudinary from 'cloudinary';
import multer from 'multer';
import bcrypt from 'bcryptjs'; // For password hashing
import mongoose from 'mongoose';
import crypto from 'crypto';

dotenv.config();

// EmailJS configuration (via REST API)
async function sendEmail({ to, subject, html }) {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey) {
        console.error('❌ EmailJS credentials not set in .env');
        return { error: 'Missing credentials' };
    }

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: serviceId,
                template_id: templateId,
                user_id: publicKey,
                accessToken: privateKey,
                template_params: {
                    to_email: to,
                    subject: subject,
                    message: html // Injected premium design
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`EmailJS Error: ${response.status} - ${errorText}`);
        }

        console.log(`✅ Email sent successfully to ${to}`);
        return { data: { id: 'emailjs_success' } };
    } catch (err) {
        console.error('❌ Failed to send email via EmailJS:', err.message);
        return { error: err.message };
    }
}

let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else {
    console.warn('⚠️ OPENAI_API_KEY not set. AI chat features will not work.');
}

// MongoDB Chat Configuration
const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
    mongoose.connect(mongoURI)
        .then(() => console.log('📦 Connected to MongoDB (Chat)'))
        .catch(err => console.error('MongoDB connection error:', err));
} else {
    console.warn('⚠️ MONGODB_URI not set. Chat features will not work.');
}

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cloudinary configuration
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
