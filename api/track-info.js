const axios = require('axios');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '../.env.local' });

// Cache en memoria
const trackCache = new Map();
const CACHE_DURATION = 300000; // 5 minutos

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // Obtener ID del track
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            error: 'ID requerido',
            message: 'Debe proporcionar un ID de track: /api/track-info?id=TRACK_ID'
        });
    }

    // Validar formato del ID
    if (!/^[a-zA-Z0-9]{22}$/.test(id)) {
        return res.status(400).json({
            error: 'ID inválido',
            message: 'El ID debe tener 22 caracteres alfanuméricos'
        });
    }

    // Verificar cache
    const cacheKey = `track_${id}`;
    const cached = trackCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log(`✅ Cache HIT para track ${id}`);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json(cached.data);
    }

    // Obtener token primero
    let accessToken;
    try {
        console.log('🔑 Requesting Spotify Token...');
        const tokenResponse = await axios.post(
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

        accessToken = tokenResponse.data.access_token;
        console.log('✅ Token obtained successfully');

    } catch (tokenError) {
        console.error('❌ Error getting token:', tokenError.message);
        return res.status(500).json({
            error: 'Error de autenticación',
            message: 'No se pudo obtener token de acceso'
        });
    }

    try {
        console.log(`🎵 Fetching data for track ID: ${id}`);


        // Obtener datos del track (Esencial)
        let trackResponse;
        try {
            trackResponse = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                timeout: 8000
            });
        } catch (err) {
            console.error(`❌ Error fetching track ${id}:`, err.message);
            if (err.response) console.error('Response:', err.response.data);
            throw err; // Track es obligatorio
        }

        // Obtener audio features (Opcional - a veces falla o devuelve 403/404)
        let featuresResponse = { data: {} };
        try {
            featuresResponse = await axios.get(`https://api.spotify.com/v1/audio-features/${id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                timeout: 8000
            });
        } catch (err) {
            console.warn(`⚠️ Could not fetch audio features for ${id}:`, err.message);
            // Ignoramos error en features, usamos valores por defecto
            featuresResponse.data = {
                danceability: 0.5, energy: 0.5, key: 0, loudness: -10,
                tempo: 120, time_signature: 4, valence: 0.5
            };
        }

        // Formatear respuesta
        const trackData = {
            id: trackResponse.data.id,
            name: trackResponse.data.name,
            artists: trackResponse.data.artists.map(artist => ({
                id: artist.id,
                name: artist.name,
                type: artist.type
            })),
            album: {
                id: trackResponse.data.album.id,
                name: trackResponse.data.album.name,
                release_date: trackResponse.data.album.release_date,
                images: trackResponse.data.album.images,
                type: trackResponse.data.album.album_type
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

        // Guardar en cache
        trackCache.set(cacheKey, {
            data: trackData,
            timestamp: Date.now()
        });

        // Limpiar cache viejo (más de 1 hora)
        const oneHourAgo = Date.now() - 3600000;
        for (const [key, value] of trackCache.entries()) {
            if (value.timestamp < oneHourAgo) {
                trackCache.delete(key);
            }
        }

        // Headers para cache
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');

        console.log(`✅ Datos obtenidos para ${trackData.name}`);

        return res.status(200).json(trackData);

    } catch (error) {
        console.error('❌ Error obteniendo track:', {
            id: id,
            message: error.message,
            status: error.response?.status
        });

        // Intentar devolver cache aunque sea viejo
        if (cached) {
            console.log('⚠️ Usando cache STALE');
            res.setHeader('X-Cache', 'STALE');
            return res.status(200).json(cached.data);
        }

        // Manejar errores específicos
        if (error.response?.status === 401) {
            return res.status(401).json({
                error: 'Token inválido o expirado',
                message: 'El token de acceso ha expirado'
            });
        }

        if (error.response?.status === 404) {
            return res.status(404).json({
                error: 'Track no encontrado',
                message: `No se encontró un track con el ID: ${id}`
            });
        }

        if (error.response?.status === 429) {
            return res.status(429).json({
                error: 'Demasiadas solicitudes',
                message: 'Límite de tasa de la API excedido'
            });
        }

        return res.status(error.response?.status || 500).json({
            error: 'Error obteniendo datos del track',
            message: error.response?.data?.error?.message || error.message
        });
    }
};