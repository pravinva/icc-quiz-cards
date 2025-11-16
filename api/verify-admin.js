// Vercel Serverless Function for Admin Authentication
// Verifies admin password stored in environment variable

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        // Get admin password from environment variable
        const adminPassword = process.env.ADMIN_PASSWORD || 'C@sas123'; // Fallback for development

        if (password === adminPassword) {
            return res.status(200).json({
                success: true,
                message: 'Authentication successful'
            });
        } else {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }

    } catch (error) {
        console.error('Error in admin verification:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
