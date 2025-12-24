// api/track-info.js
const axios = require('axios');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // Obtener ID del track desde query parameters
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            error: 'ID de track requerido',
            message: 'Debes proporcionar un ID de track de Spotify'
        });
    }

    // Validar formato del ID (alphanum, longitud 22 caracteres)
    if (!/^[a-zA-Z0-9]{22}$/.test(id)) {
        return res.status(400).json({
            error: 'ID de track inválido',
            message: 'El ID de track debe tener 22 caracteres alfanuméricos'
        });
    }

    // Obtener token de acceso primero
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({
            error: 'Configuración incompleta',
            message: 'Faltan credenciales de Spotify'
        });
    }

    try {
        // 1. Obtener token de acceso
        const tokenResponse = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // 2. Obtener información del track
        const [trackResponse, featuresResponse] = await Promise.all([
            axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            axios.get(`https://api.spotify.com/v1/audio-features/${id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
        ]);

        // 3. Formatear respuesta
        const trackData = {
            id: trackResponse.data.id,
            name: trackResponse.data.name,
            artists: trackResponse.data.artists.map(artist => ({
                id: artist.id,
                name: artist.name
            })),
            album: {
                id: trackResponse.data.album.id,
                name: trackResponse.data.album.name,
                images: trackResponse.data.album.images,
                release_date: trackResponse.data.album.release_date
            },
            duration_ms: trackResponse.data.duration_ms,
            popularity: trackResponse.data.popularity,
            preview_url: trackResponse.data.preview_url,
            external_urls: trackResponse.data.external_urls,
            audio_features: {
                danceability: featuresResponse.data.danceability,
                energy: featuresResponse.data.energy,
                key: featuresResponse.data.key,
                loudness: featuresResponse.data.loudness,
                tempo: featuresResponse.data.tempo,
                time_signature: featuresResponse.data.time_signature,
                valence: featuresResponse.data.valence
            }
        };

        // Configurar cache (5 minutos para datos de tracks)
        res.setHeader('Cache-Control', 'public, max-age=300');

        return res.status(200).json(trackData);

    } catch (error) {
        console.error('ERROR obteniendo info del track:', {
            id: id,
            message: error.message,
            status: error.response?.status
        });

        // Manejo de errores específicos
        if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'Token inválido',
                message: 'El token de acceso ha expirado o es inválido'
            });
        } else if (error.response?.status === 404) {
            return res.status(404).json({
                error: 'Track no encontrado',
                message: 'No se encontró un track con el ID proporcionado'
            });
        } else if (error.response?.status === 429) {
            return res.status(429).json({
                error: 'Límite de tasa excedido',
                message: 'Demasiadas solicitudes a la API de Spotify'
            });
        } else if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error de Spotify API',
                details: error.response.data
            });
        } else {
            return res.status(500).json({
                error: 'Error interno del servidor',
                message: error.message
            });
        }
    }
};