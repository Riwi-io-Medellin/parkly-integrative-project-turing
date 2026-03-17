import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// MySQL database configuration object
export const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // Set SSL based on environment requirements
    ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : { rejectUnauthorized: true }
};

// Function to create a new MySQL connection
export async function getConnection() {
    return await mysql.createConnection(dbConfig);
}

// MongoDB connection for the chat feature
const mongoURI = process.env.MONGODB_URI;
if (mongoURI) {
    mongoose.connect(mongoURI)
        .then(() => console.log('Connected to MongoDB for chat'))
        .catch(err => console.error('MongoDB connection error:', err));
}

// Schema defining how chat messages are stored in MongoDB
const chatMessageSchema = new mongoose.Schema({
    reservationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderEmail: { type: String, required: true },
    receiverEmail: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Export the model to use it for chat operations
export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
