import express from "express";
import OpenAI from "openai";
import cors from "cors";
import dotenv from "dotenv";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// uses the cheapest model just to decide if a message is parking-related or not
async function isValidMessage(message) {
  const result = await client.chat.completions.create({
    model: "gpt-4.1-nano",
    temperature: 0,
    max_tokens: 5,
    messages: [
      {
        role: "system",
        content: `You are a message classifier for the Parkly parking app.
Respond ONLY with "YES" or "NO".

Respond "YES" if the message is related to:

Searching, reserving, or canceling parking spaces / parking lots / parking

Availability, prices, schedules, or location of parking spaces

Payments, invoices, or payment methods within the app

Use, technical support, or problems with the Parkly application

General questions about how the service works

Respond "NO" only if the message clearly has nothing to do with parking spaces
or with the app (e.g., cooking recipes, history homework, jokes, etc.).

If in doubt, respond "YES".
        `.trim(),
      },
      { role: "user", content: message },
    ],
  });

  const response = result?.choices?.[0]?.message?.content?.trim().toUpperCase();
  return response === "YES";
}

// main endpoint — validates the message, then sends it to the real model
app.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ reply: "You must send a message." });
    }

    // super short messages like "ok" or "thanks" skip the classifier
    const isShortMessage = message.trim().split(/\s+/).length <= 2;

    if (!isShortMessage) {
      const valid = await isValidMessage(message);
      if (!valid) {
        return res.json({
          reply:
            "I can only help you with Parkly-related topics: finding parking spaces, reservations, payments, and app support. How can I help you?",
        });
      }
    }

    // keep conversation context manageable
    const limitedHistory = history.slice(-10);