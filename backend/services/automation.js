// Function to trigger external automation webhooks (e.g., Make or n8n)
export async function triggerAutomation(event, payload) {
    const webhookUrl = process.env.AUTOMATION_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
    
    // Skip if no webhook URL is configured
    if (!webhookUrl) {
        console.warn(`Automation webhook URL not set. Event '${event}' was not sent.`);
        return;
    }

    try {
        // Send event data via POST request
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                event, 
                ...payload, 
                timestamp: new Date() 
            })
        });
        console.log(`Automation event '${event}' triggered.`);
    } catch (e) {
        console.error(`Automation error (${event}):`, e.message);
    }
}
