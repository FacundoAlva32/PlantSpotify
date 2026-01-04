const axios = require('axios');
require('dotenv').config({ path: '.env.local' }); // Try default
require('dotenv').config({ path: '../.env.local' }); // Try parent if in api/ subdir

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.error('❌ Missing environment variables');
        return res.status(500).json({ error: 'Configuration error: Missing Environment Variables' });
    }

    try {
        const response = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                    ).toString('base64')
                }
            }
        );

        // Cachear respuesta
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

        console.log('✅ Spotify Token acquired successfully');

        res.status(200).json({
            accessToken: response.data.access_token,
            expiresIn: response.data.expires_in
        });

    } catch (error) {
        console.error('❌ Error Getting Spotify Token:', error.message);
        if (error.response) {
            console.error('Error Response Data:', JSON.stringify(error.response.data));
            console.error('Error Status:', error.response.status);
        }
        res.status(500).json({
            error: 'Error de autenticación con Spotify',
            details: error.message,
            spotifyError: error.response?.data
        });
    }
};