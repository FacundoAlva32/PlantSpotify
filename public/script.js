// =============== VARIABLES GLOBALES ===============
const card = document.getElementById('card');
let spotifyCache = {
    token: null,
    tokenExpiry: 0,
    tracks: {}
};
let currentTotalDuration = 210; // 3:30 por defecto

// =============== INICIALIZACIÓN ===============
document.addEventListener('DOMContentLoaded', function () {
    console.log('🎵 PlantSpotify iniciado');

    // Vincular eventos de inputs
    document.getElementById('inSong').addEventListener('input', updateText);
    document.getElementById('inArtist').addEventListener('input', updateText);
    document.getElementById('inPhrase').addEventListener('input', updateText);

    // Eventos de estilo
    const styleInputs = ['textColor', 'accentColor', 'bgColor', 'bgOpacity',
        'borderColor', 'borderWidth', 'borderRadius', 'shadowIntensity', 'blurIntensity',
        'fontStyle', 'cardSize'];
    styleInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateStyle);
    });

    // Eventos de progreso
    document.getElementById('progRange').addEventListener('input', updateProgress);
    document.getElementById('inTime').addEventListener('change', updateDuration);
    document.getElementById('codeColor').addEventListener('change', updateCode);

    // Eventos de archivos
    document.getElementById('imgUpload').addEventListener('change', uploadCover);

    // Eventos de botones
    document.querySelector('.btn-check').addEventListener('click', updateCode);
    document.querySelector('.btn-trash').addEventListener('click', removeCover);
    document.querySelector('.btn-reset').addEventListener('click', resetConfig);
    document.querySelector('.btn-confirm').addEventListener('click', downloadPNG);

    // Enter en campo de link
    document.getElementById('link').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') updateCode();
    });

    // Inicializar valores
    updateText();
    updateStyle();
    updateProgress();

    // Pre-cargar token en segundo plano
    setTimeout(preloadToken, 1000);
});

// =============== FUNCIONES BÁSICAS ===============

function updateText() {
    document.getElementById('outSong').textContent =
        document.getElementById('inSong').value || "Nombre Canción";
    document.getElementById('outArtist').textContent =
        document.getElementById('inArtist').value || "Nombre Artista";
    document.getElementById('outPhrase').textContent =
        `"${document.getElementById('inPhrase').value}"`;
}

function updateStyle() {
    // Colores
    const txt = document.getElementById('textColor').value;
    const bg = document.getElementById('bgColor').value;
    const op = document.getElementById('bgOpacity').value;
    const acc = document.getElementById('accentColor').value;

    // Aplicar variables CSS
    card.style.setProperty('--text', txt);
    card.style.setProperty('--accent', acc);

    // Color tenue para barra de fondo
    const rT = parseInt(txt.slice(1, 3), 16);
    const gT = parseInt(txt.slice(3, 5), 16);
    const bT = parseInt(txt.slice(5, 7), 16);
    card.style.setProperty('--text-faint', `rgba(${rT}, ${gT}, ${bT}, 0.15)`);

    // Fondo con opacidad
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    card.style.background = `rgba(${r}, ${g}, ${b}, ${op})`;

    // Borde
    const bColor = document.getElementById('borderColor').value;
    const bWidth = document.getElementById('borderWidth').value;
    const bRadius = document.getElementById('borderRadius').value;
    card.style.border = `${bWidth}px solid ${bColor}`;
    card.style.borderRadius = `${bRadius}px`;

    // Sombra
    const shadowInt = document.getElementById('shadowIntensity').value;
    if (shadowInt > 0) {
        card.style.boxShadow = `0px 10px ${shadowInt}px rgba(0,0,0,0.5)`;
    } else {
        card.style.boxShadow = 'none';
    }

    // Blur (Backdrop filter)
    const blurInt = document.getElementById('blurIntensity').value;
    if (blurInt > 0) {
        card.style.backdropFilter = `blur(${blurInt}px)`;
        card.style.webkitBackdropFilter = `blur(${blurInt}px)`;
    } else {
        card.style.backdropFilter = 'none';
        card.style.webkitBackdropFilter = 'none';
    }

    // Tamaño
    card.style.width = document.getElementById('cardSize').value + 'px';

    // Fuente
    const fontClass = document.getElementById('fontStyle').value;
    document.getElementById('outPhrase').className = `phrase ${fontClass}`;
}

function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 210;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 210;
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return (minutes * 60) + seconds;
}

function updateDuration() {
    const timeVal = document.getElementById('inTime').value;

    // Validar formato "MM:SS" o "M:SS"
    const timeRegex = /^(\d{1,2}):([0-5][0-9])$/;

    if (timeRegex.test(timeVal)) {
        // Asegurar formato de 2 dígitos para minutos
        const parts = timeVal.split(':');
        const minutes = parts[0].padStart(2, '0');
        const seconds = parts[1];
        const formattedTime = `${minutes}:${seconds}`;

        // Calcular segundos actuales
        const currentSeconds = (parseInt(minutes) * 60) + parseInt(seconds);

        // Calcular porcentaje (evitando división por cero)
        const percent = currentTotalDuration > 0 ? (currentSeconds / currentTotalDuration) * 100 : 0;

        // Limitar porcentaje entre 0 y 100
        const safePercent = Math.min(100, Math.max(0, percent));

        // Actualizar UI
        document.getElementById('progRange').value = safePercent;
        document.getElementById('currTime').textContent = formattedTime;

        console.log(`⏱️ Tiempo actual ajustado: ${formattedTime} (${safePercent.toFixed(1)}%)`);
    }
}

function updateProgress() {
    const val = document.getElementById('progRange').value;
    document.getElementById('barFill').style.width = val + '%';

    // Calcular tiempo actual basado en porcentaje del total
    const currentSeconds = Math.floor((val / 100) * currentTotalDuration);

    const min = Math.floor(currentSeconds / 60).toString().padStart(2, '0');
    const sec = (currentSeconds % 60).toString().padStart(2, '0');
    const formattedTime = `${min}:${sec}`;

    document.getElementById('currTime').textContent = formattedTime;

    // Actualizar input también para mantener sincronía (opcional, pero user friendly)
    // Evitamos ciclo infinito solo si el foco no está en el input
    if (document.activeElement.id !== 'inTime') {
        document.getElementById('inTime').value = formattedTime;
    }
}

function uploadCover() {
    const file = document.getElementById('imgUpload').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('coverImg');
            const container = document.getElementById('coverContainer');

            img.src = e.target.result;
            // Al ser local (dataURL), no necesitamos crossOrigin, pero no estorba

            container.style.display = 'block';

            // Botón eliminar
            let btn = document.querySelector('.btn-delete-cover');
            if (!btn) {
                btn = document.createElement('button');
                btn.className = 'btn-small btn-trash btn-delete-cover';
                btn.innerHTML = '<i class="fas fa-trash"></i>';
                btn.onclick = removeCover;
                btn.style.marginTop = '10px';
                btn.style.width = '100%';
                document.querySelector('.input-with-btn').parentNode.appendChild(btn);
            }
        }
        reader.readAsDataURL(file);
    }
}

function removeCover() {
    const img = document.getElementById('coverImg');
    const container = document.getElementById('coverContainer');

    img.src = '';
    container.style.display = 'none';
    document.getElementById('imgUpload').value = '';

    const btn = document.querySelector('.btn-delete-cover');
    if (btn) btn.remove();
}

// =============== SISTEMA DE SPOTIFY ===============

async function preloadToken() {
    try {
        const token = await getSpotifyToken();
        if (token) {
            console.log('✅ Token pre-cargado');
            document.getElementById('apiStatus').textContent = '● Conectado';
            document.getElementById('apiStatus').style.color = '#1DB954';
        }
    } catch (error) {
        console.log('Token no pre-cargado');
        document.getElementById('apiStatus').textContent = '● Modo offline';
        document.getElementById('apiStatus').style.color = '#f39c12';
    }
}

async function getSpotifyToken() {
    // Verificar cache
    if (spotifyCache.token && Date.now() < spotifyCache.tokenExpiry) {
        return spotifyCache.token;
    }

    try {
        const response = await fetch('/api/spotify-token', {
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (!data.accessToken) {
            throw new Error('No token received');
        }

        // Actualizar cache
        spotifyCache.token = data.accessToken;
        spotifyCache.tokenExpiry = Date.now() + 3300000; // 55 minutos

        return data.accessToken;

    } catch (error) {
        console.warn('Error obteniendo token:', error.message);
        return null;
    }
}

async function fetchTrackDetails(trackId) {
    const btn = document.querySelector('.btn-check');
    const btnIcon = btn.querySelector('i');
    const originalIcon = btnIcon.className;

    // Mostrar loading
    btnIcon.className = 'fas fa-spinner fa-spin';
    btn.disabled = true;

    console.log(`🎵 Buscando track ${trackId}...`);

    try {
        // Llamar a nuestra API
        const response = await fetch(`/api/track-info?id=${trackId}`, {
            signal: AbortSignal.timeout(10000)
        });

        console.log('📡 Respuesta API:', response.status);

        if (!response.ok) {
            throw new Error(`API error ${response.status}`);
        }

        const trackData = await response.json();
        console.log('📊 Datos RAW de API:', trackData);

        // VERIFICAR SI LOS DATOS TIENEN LA ESTRUCTURA CORRECTA
        if (!trackData) {
            throw new Error('No data received');
        }

        // 1. NOMBRE DE LA CANCIÓN
        if (trackData.name) {
            document.getElementById('inSong').value = trackData.name;
            document.getElementById('outSong').textContent = trackData.name;
            console.log('✅ Canción:', trackData.name);
        } else {
            console.warn('No name in track data');
        }

        // 2. ARTISTA(S)
        if (trackData.artists && Array.isArray(trackData.artists)) {
            const artistNames = trackData.artists.map(a => a.name).join(', ');
            document.getElementById('inArtist').value = artistNames;
            document.getElementById('outArtist').textContent = artistNames;
            console.log('✅ Artistas:', artistNames);
        } else {
            console.warn('No artists in track data');
        }

        // 3. DURACIÓN - ESTO ES LO MÁS IMPORTANTE
        console.log('⏱️ duration_ms value:', trackData.duration_ms);
        console.log('⏱️ typeof duration_ms:', typeof trackData.duration_ms);

        if (trackData.duration_ms && !isNaN(trackData.duration_ms)) {
            const ms = parseInt(trackData.duration_ms);
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            console.log(`⏱️ Conversión: ${ms}ms -> ${totalSeconds}s -> ${minutes}:${seconds.toString().padStart(2, '0')}`);

            // Guardar duración total global
            currentTotalDuration = totalSeconds;

            // Actualizar display de duración total (derecha)
            document.getElementById('endTime').textContent = formattedDuration;

            // Reiniciar tiempo actual a 0 o un valor random bajo
            document.getElementById('inTime').value = "00:00";
            document.getElementById('progRange').value = 0;

            // Forzar actualización de progreso
            updateProgress();
            console.log('✅ Duración TOTAL actualizada desde API:', formattedDuration);
        } else {
            console.warn('⚠️ duration_ms es inválido:', trackData.duration_ms);
            // Valor por defecto
            document.getElementById('inTime').value = "03:30";
            document.getElementById('endTime').textContent = "03:30";
            updateDuration();
        }

        // 4. PROGRESO ALEATORIO
        const randomPercent = Math.floor(Math.random() * 70) + 15;
        document.getElementById('progRange').value = randomPercent;
        console.log('📈 Progreso aleatorio:', randomPercent + '%');

        // 5. SINCRONIZAR TODO
        updateText();
        updateProgress();

        // 6. Cachear para futuro
        spotifyCache.tracks[trackId] = trackData;

        btnIcon.className = originalIcon;
        btn.disabled = false;
        showNotification('Datos obtenidos de Spotify ✓', 'success');

        // 7. Intentar cargar portada del álbum si existe
        if (trackData.album?.images?.[0]?.url) {
            setTimeout(() => loadAlbumCover(trackData.album.images[0].url), 500);
        }

    } catch (error) {
        console.error('❌ Error en fetchTrackDetails:', error);

        // Fallback a scraping
        try {
            console.log('🔄 Intentando fallback...');
            await fetchTrackFallback(trackId);
        } catch (fallbackError) {
            console.error('Fallback también falló:', fallbackError);
            showNotification('Error obteniendo datos. Usa entrada manual.', 'error');
        }

        btnIcon.className = originalIcon;
        btn.disabled = false;
    }
}

async function fetchTrackFallback(trackId) {
    try {
        // Usar proxy para scraping
        const proxyUrl = 'https://corsproxy.io/?';
        const spotifyUrl = `https://open.spotify.com/track/${trackId}`;

        const response = await fetch(proxyUrl + encodeURIComponent(spotifyUrl), {
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) throw new Error('Proxy error');

        const data = await response.json();

        if (data.contents) {
            const html = data.contents;
            const titleMatch = html.match(/<title>(.*?)<\/title>/i);

            if (titleMatch) {
                const title = titleMatch[1];

                // Parsear diferentes formatos
                let songName = "Canción";
                let artistName = "Artista";

                // Formato 1: "Canción - song by Artista | Spotify"
                const match1 = title.match(/^(.*?)\s+-\s+(?:song|single|album|.*?)\s+by\s+(.*?)\s+\|\s+Spotify/i);
                if (match1) {
                    songName = match1[1].trim();
                    artistName = match1[2].trim();
                }
                // Formato 2: "Canción · Artista | Spotify"
                else {
                    const match2 = title.match(/^(.*?)\s+[·•]\s+(.*?)\s+\|\s+Spotify/i);
                    if (match2) {
                        songName = match2[1].trim();
                        artistName = match2[2].trim();
                    }
                }

                // Limpiar HTML entities
                songName = songName.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
                artistName = artistName.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

                // Actualizar UI
                document.getElementById('inSong').value = songName;
                document.getElementById('inArtist').value = artistName;
                updateText();

                // Duración aleatoria (entre 2:30 y 4:30)
                const min = Math.floor(Math.random() * 2) + 2;
                const sec = Math.floor(Math.random() * 60).toString().padStart(2, '0');
                const duration = `${min}:${sec}`;

                // Actualizar duración total
                currentTotalDuration = (min * 60) + parseInt(sec);
                document.getElementById('endTime').textContent = duration;

                // Progreso aleatorio
                const randomPercent = Math.floor(Math.random() * 70) + 15;
                document.getElementById('progRange').value = randomPercent;

                // Forzar actualización de UI
                updateProgress();

                // Cachear
                spotifyCache.tracks[trackId] = {
                    name: songName,
                    artists: [{ name: artistName }],
                    duration_ms: currentTotalDuration * 1000
                };

                showNotification('Datos obtenidos (Duración estimada) ⚠', 'warning');
                return true;
            }
        }
        throw new Error('No se pudo parsear HTML');

    } catch (error) {
        console.error('Fallback error:', error);
        throw error;
    }
}

// function loadAlbumCover(imageUrl) { ... }
// Esta lógica ahora es manejada directamente o usando la nueva versión:

function loadAlbumCover(imageUrl) {
    const img = document.getElementById('coverImg');
    const container = document.getElementById('coverContainer');

    // Asignar crossOrigin ANTES de src para que funcione con Canvas
    img.crossOrigin = 'anonymous';

    img.onload = function () {
        container.style.display = 'block';
        showNotification('Portada del álbum cargada ✓', 'success');
    };

    img.onerror = function () {
        console.log('No se pudo cargar la portada del álbum');
        container.style.display = 'none';
    };

    img.src = imageUrl;
}

// =============== UPDATE CODE ===============

function updateCode() {
    const linkVal = document.getElementById('link').value.trim();

    // Extraer ID del track
    let trackId = null;
    let uriType = 'track';

    // Diferentes formatos de enlace
    const patterns = [
        /track\/([a-zA-Z0-9]{22})/,           // open.spotify.com/track/ID
        /spotify:track:([a-zA-Z0-9]{22})/,    // spotify:track:ID
        /album\/([a-zA-Z0-9]{22})/,           // álbum
        /playlist\/([a-zA-Z0-9]{22})/         // playlist
    ];

    for (let i = 0; i < patterns.length; i++) {
        const match = linkVal.match(patterns[i]);
        if (match) {
            trackId = match[1];
            if (i === 2) uriType = 'album';
            if (i === 3) uriType = 'playlist';
            break;
        }
    }

    if (!trackId) {
        showNotification('❌ Enlace no válido. Ejemplo: https://open.spotify.com/track/...', 'error');
        return;
    }

    // Actualizar código QR
    const color = document.getElementById('codeColor').value;
    const barColor = color === 'white' ? 'ffffff' : '000000';
    const codeBg = color === 'white' ? 'transparent' : 'white';
    const uri = `spotify:${uriType}:${trackId}`;

    document.getElementById('code').src =
        `https://scannables.scdn.co/uri/plain/png/${barColor}/${codeBg}/800/${uri}`;

    // Si es track, obtener datos
    if (uriType === 'track') {
        fetchTrackDetails(trackId);
    } else {
        showNotification(`Código QR de ${uriType} actualizado`, 'info');
    }
}

// =============== RESET ===============

function resetConfig() {
    if (!confirm('¿Restablecer toda la configuración a valores predeterminados?')) {
        return;
    }

    // Restablecer inputs
    document.getElementById('inSong').value = '';
    document.getElementById('inArtist').value = '';
    document.getElementById('inPhrase').value = 'Yo viajo a tu lado con lo bueno y lo malo';
    document.getElementById('textColor').value = '#000000';
    document.getElementById('accentColor').value = '#1DB954';
    document.getElementById('bgColor').value = '#FFFFFF';
    document.getElementById('bgOpacity').value = '1';
    document.getElementById('borderColor').value = '#000000';
    document.getElementById('borderWidth').value = '0';
    document.getElementById('borderRadius').value = '0';
    document.getElementById('shadowIntensity').value = '0';
    document.getElementById('blurIntensity').value = '0';
    document.getElementById('codeColor').value = 'black';
    document.getElementById('fontStyle').value = 'font-hand';
    document.getElementById('progRange').value = '30';

    // Resetear duración
    currentTotalDuration = 210; // 3:30
    document.getElementById('endTime').textContent = '03:30';
    // El inTime se actualizará con updateProgress basado en progRange=30
    document.getElementById('link').value = '';
    document.getElementById('imgUpload').value = '';
    document.getElementById('cardSize').value = '350';

    // Remover portada
    removeCover();

    // Actualizar UI
    updateText();
    updateStyle();
    updateProgress();

    // Resetear código QR
    document.getElementById('code').src =
        'https://scannables.scdn.co/uri/plain/png/000000/white/800/spotify:track:5p7GiZKxLC2cisUKqLC0vW';

    showNotification('Configuración restablecida ✓', 'info');
}

// =============== DESCARGAR PNG ===============

function downloadPNG() {
    showNotification('Generando imagen de alta calidad...', 'info');

    // Ocultar elementos temporales
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';

    // Pequeño delay para asegurar renderizado
    setTimeout(() => {
        html2canvas(card, {
            scale: 4, // Mayor calidad
            useCORS: true, // Crucial para imágenes de Spotify
            allowTaint: false, // Desactivar taint para evitar bloqueos
            backgroundColor: null, // Mantener transparencia
            logging: false,
            imageTimeout: 0,
            onclone: (clonedDoc) => {
                const clonedCard = clonedDoc.getElementById('card');
                // Asegurar que no haya transformaciones que corten la imagen
                clonedCard.style.transform = 'none';
            }
        }).then(canvas => {
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `plantspotify-${timestamp}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            document.body.style.cursor = originalCursor;
            showNotification('Imagen descargada ✓ (HD)', 'success');

        }).catch(error => {
            console.error('Error generando imagen:', error);
            document.body.style.cursor = originalCursor;
            showNotification('Error al generar imagen', 'error');
        });
    }, 100);
}

// =============== NOTIFICACIONES ===============

function showNotification(message, type = 'info') {
    // Eliminar notificaciones anteriores
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());

    // Crear notificación
    const notification = document.createElement('div');
    notification.className = 'notification';

    // Icono según tipo
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };

    // Estilos según tipo
    const styles = {
        success: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
        error: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
        warning: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
        info: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
    };

    notification.style.background = styles[type] || styles.info;
    notification.innerHTML = `<strong>${icons[type] || ''}</strong> ${message}`;

    document.body.appendChild(notification);

    // Mostrar con animación
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto-eliminar después de 4 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 400);
    }, 4000);
}

// =============== INICIALIZACIÓN FINAL ===============

// Pre-cargar algunos datos populares
window.addEventListener('load', () => {
    console.log('PlantSpotify listo 🎵');
});
