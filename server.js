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
