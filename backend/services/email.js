import dotenv from 'dotenv';

dotenv.config();

/**
 * Function to send emails using the Resend API.
 * Uses the RESEND_API_KEY defined in the .env file.
 */
export async function sendEmail({ to, subject, html }) {
    const apiKey = process.env.RESEND_API_KEY;

    // Check if API key is present
    if (!apiKey) {
        console.warn('Resend API Key missing in .env. Email was not sent.');
        return { error: 'Missing API Key' };
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Parkly <onboarding@resend.dev>', // Default Resend test address
                to: [to],
                subject: subject,
                html: html
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Resend error');
        }

        console.log(`Email successfully sent to ${to} (ID: ${data.id})`);
        return { data };
    } catch (err) {
        console.error('Resend service failure:', err.message);
        return { error: err.message };
    }
}
