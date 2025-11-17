// Load environment variables (for local development)
// In Vercel, environment variables are automatically available via process.env
try {
    if (typeof require !== 'undefined') {
        require('dotenv').config({ path: '.env.local' });
    }
} catch (e) {
    // dotenv not available (Vercel environment)
}

// Vercel Serverless Function for Google Cloud Text-to-Speech
// This securely calls the Google Cloud TTS API without exposing credentials in the frontend

async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, voiceName = 'en-US-Neural2-F', languageCode = 'en-US', speed = 1.0 } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Get API key from environment variables
        const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;

        if (!apiKey) {
            // If no API key, return error instructing user to set it up
            return res.status(500).json({
                error: 'Google Cloud TTS not configured. Please add GOOGLE_CLOUD_TTS_API_KEY to your Vercel environment variables or .env.local file.'
            });
        }

        // Call Google Cloud Text-to-Speech API
        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: { text },
                    voice: {
                        languageCode,
                        name: voiceName,
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: speed,
                        pitch: 0,
                        volumeGainDb: 0,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Google Cloud TTS API error:', errorData);
            return res.status(response.status).json({
                error: 'Failed to generate speech',
                details: errorData
            });
        }

        const data = await response.json();

        // Return the audio content (base64 encoded MP3)
        res.status(200).json({
            audioContent: data.audioContent,
            voiceName,
            languageCode,
        });

    } catch (error) {
        console.error('Error in text-to-speech function:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// ES module export (for Vercel)
export default handler;

// CommonJS export (for local server)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { default: handler };
}
