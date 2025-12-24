// Variables globales
const card = document.getElementById('card');
let cachedAccessToken = null;
let tokenExpiryTime = null;

// =============== INICIALIZACIÓN ===============
document.addEventListener('DOMContentLoaded', function () {
    // Vincular eventos a todos los inputs
    document.getElementById('inSong').addEventListener('input', updateText);
    document.getElementById('inArtist').addEventListener('input', updateText);
    document.getElementById('inPhrase').addEventListener('input', updateText);

    document.getElementById('textColor').addEventListener('input', updateStyle);
    document.getElementById('accentColor').addEventListener('input', updateStyle);
    document.getElementById('bgColor').addEventListener('input', updateStyle);
    document.getElementById('bgOpacity').addEventListener('input', updateStyle);
    document.getElementById('borderColor').addEventListener('input', updateStyle);
    document.getElementById('borderWidth').addEventListener('input', updateStyle);
    document.getElementById('fontStyle').addEventListener('change', updateStyle);
    document.getElementById('cardSize').addEventListener('input', updateStyle);

    document.getElementById('progRange').addEventListener('input', updateProgress);
    document.getElementById('inTime').addEventListener('change', updateDuration);
    document.getElementById('codeColor').addEventListener('change', updateCode);

    document.getElementById('imgUpload').addEventListener('change', uploadCover);

    // Configurar botones
    document.querySelector('.btn-check').addEventListener('click', updateCode);
    document.querySelector('.btn-trash').addEventListener('click', removeCover);
    document.querySelector('.btn-reset').addEventListener('click', resetConfig);
    document.querySelector('.btn-confirm').addEventListener('click', downloadPNG);

    // Inicializar valores
    updateText();
    updateStyle();
    updateProgress();
});

// =============== FUNCIONES PRINCIPALES ===============

// 1. Actualizar texto en tiempo real
function updateText() {
    document.getElementById('outSong').innerText =
        document.getElementById('inSong').value || "Canción";
    document.getElementById('outArtist').innerText =
        document.getElementById('inArtist').value || "Artista";
    document.getElementById('outPhrase').innerText =
        `"${document.getElementById('inPhrase').value}"`;
}

// 2. Actualizar estilos de la tarjeta
function updateStyle() {
    // Colores
    const txt = document.getElementById('textColor').value;
    const bg = document.getElementById('bgColor').value;
    const op = document.getElementById('bgOpacity').value;
    const acc = document.getElementById('accentColor').value;

    // Aplicar variables CSS
    card.style.setProperty('--text', txt);
    card.style.setProperty('--accent', acc);

    // Calcular color tenue para barra de fondo
    const rT = parseInt(txt.slice(1, 3), 16);
    const gT = parseInt(txt.slice(3, 5), 16);
    const bT = parseInt(txt.slice(5, 7), 16);
    card.style.setProperty('--text-faint', `rgba(${rT}, ${gT}, ${bT}, 0.2)`);

    // Fondo con opacidad
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    card.style.background = `rgba(${r}, ${g}, ${b}, ${op})`;

    // Borde
    const bColor = document.getElementById('borderColor').value;
    const bWidth = document.getElementById('borderWidth').value;
    card.style.border = `${bWidth}px solid ${bColor}`;

    // Tamaño
    card.style.width = document.getElementById('cardSize').value + "px";

    // Fuente
    const fontClass = document.getElementById('fontStyle').value;
    document.getElementById('outPhrase').className = `phrase ${fontClass}`;
}

// 3. Actualizar progreso de canción
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 210; // Default 3:30
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 210;
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return (minutes * 60) + seconds;
}

function updateDuration() {
    const timeVal = document.getElementById('inTime').value;
    if (timeVal.includes(':')) {
        document.getElementById('endTime').innerText = timeVal;
        updateProgress();
    }
}

function updateProgress() {
    const val = document.getElementById('progRange').value;
    document.getElementById('barFill').style.width = val + "%";

    const totalSeconds = parseTimeToSeconds(document.getElementById('inTime').value);
    const currentSeconds = Math.floor((val / 100) * totalSeconds);
    const min = Math.floor(currentSeconds / 60).toString().padStart(2, '0');
    const sec = (currentSeconds % 60).toString().padStart(2, '0');
    document.getElementById('currTime').innerText = `${min}:${sec}`;
}

// 4. Subir portada personalizada
function uploadCover() {
    const input = document.getElementById('imgUpload');
    const container = document.getElementById('coverContainer');
    const imgDiv = document.getElementById('coverImg');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            imgDiv.style.backgroundImage = `url(${e.target.result})`;
            container.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function removeCover() {
    document.getElementById('imgUpload').value = "";
    document.getElementById('coverContainer').style.display = "none";
    document.getElementById('coverImg').style.backgroundImage = "";
}

// 5. Sistema de API de Spotify
async function fetchSpotifyAccessToken() {
    // Verificar cache (dura 55 minutos)
    if (cachedAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
        return cachedAccessToken;
    }

    try {
        // Usar ruta relativa que funciona en local y producción
        const baseUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin;

        const response = await fetch(`${baseUrl}/api/spotify-token`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.accessToken) {
            throw new Error('No access token received');
        }

        cachedAccessToken = data.accessToken;
        tokenExpiryTime = Date.now() + 3300000; // 55 minutos
        return cachedAccessToken;

    } catch (error) {
        console.error("Error obteniendo token de Spotify:", error);
        // Fallback: usar API de terceros si falla la oficial
        showNotification('Usando modo fallback (sin API oficial)', 'warning');
        return null;
    }
}

// 6. Obtener datos del track desde Spotify API
async function fetchTrackDetails(trackId) {
    // Mostrar loading
    const btnIcon = document.querySelector('.btn-check i');
    const originalIcon = btnIcon.className;
    btnIcon.className = 'fas fa-spinner fa-spin';

    try {
        // Opción 1: Usar nuestra API (recomendado)
        const baseUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : window.location.origin;

        const response = await fetch(`${baseUrl}/api/track-info?id=${trackId}`);

        if (response.ok) {
            const trackData = await response.json();

            // Actualizar interfaz
            if (trackData.name) {
                document.getElementById('inSong').value = trackData.name;
            }
            if (trackData.artists) {
                document.getElementById('inArtist').value = trackData.artists.map(a => a.name).join(', ');
            }
            if (trackData.duration_ms) {
                const totalSeconds = Math.floor(trackData.duration_ms / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                document.getElementById('inTime').value = formattedDuration;
                document.getElementById('endTime').innerText = formattedDuration;
            }

            updateText();
            updateDuration();
            showNotification('Datos obtenidos de Spotify ✓', 'success');

        } else {
            // Opción 2: Fallback a scraping simple si la API falla
            await fetchTrackFallback(trackId);
        }

    } catch (error) {
        console.error("Error obteniendo datos del track:", error);
        showNotification('Error obteniendo datos. Usando valores por defecto.', 'error');
    } finally {
        btnIcon.className = originalIcon;
    }
}

// 7. Fallback para cuando la API no funciona
async function fetchTrackFallback(trackId) {
    try {
        // Usar allOrigins como fallback
        const url = `https://open.spotify.com/track/${trackId}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, "text/html");
            const title = doc.querySelector('title').innerText;

            // Parsear título
            const regex = /^(.*?) - (?:song|single|album|.*?) by (.*?) \| Spotify/i;
            const match = title.match(regex);

            if (match && match.length >= 3) {
                document.getElementById('inSong').value = match[1].trim();
                document.getElementById('inArtist').value = match[2].trim();
                updateText();
                showNotification('Datos obtenidos (modo fallback) ✓', 'warning');
            }
        }
    } catch (error) {
        console.error("Error en fallback:", error);
    }
}

// 8. Actualizar código QR
function updateCode() {
    const linkVal = document.getElementById('link').value;
    const m = linkVal.match(/(track|album|playlist)\/([a-zA-Z0-9]+)/);

    if (!m) {
        showNotification('Enlace de Spotify no válido', 'error');
        return;
    }

    const uri = `spotify:${m[1]}:${m[2]}`;
    const color = document.getElementById('codeColor').value;

    // Configurar colores del código QR
    let barColor, codeBg;
    if (color === 'white') {
        barColor = 'ffffff';
        codeBg = 'transparent';
    } else {
        barColor = '000000';
        codeBg = 'white';
    }

    // Actualizar imagen del código QR
    const codeImg = document.getElementById('code');
    codeImg.src = `https://scannables.scdn.co/uri/plain/png/${barColor}/${codeBg}/800/${uri}`;

    // Si es un track, obtener detalles automáticamente
    if (m[1] === 'track') {
        const trackId = m[2];
        fetchTrackDetails(trackId);

        // Aleatorizar tiempo de progreso
        const totalSeconds = parseTimeToSeconds(document.getElementById('inTime').value);
        if (totalSeconds > 0) {
            const randomPercent = Math.floor(Math.random() * 80) + 10;
            document.getElementById('progRange').value = randomPercent;
            updateProgress();
        }
    }
}

// 9. Resetear configuración
function resetConfig() {
    if (!confirm('¿Estás seguro de que quieres resetear toda la configuración?')) {
        return;
    }

    // Restablecer inputs
    document.getElementById('inSong').value = "";
    document.getElementById('inArtist').value = "";
    document.getElementById('inPhrase').value = "Yo viajo a tu lado con lo bueno y lo malo";
    document.getElementById('textColor').value = "#000000";
    document.getElementById('accentColor').value = "#ff0000";
    document.getElementById('bgColor').value = "#ffffff";
    document.getElementById('bgOpacity').value = "1";
    document.getElementById('borderColor').value = "#000000";
    document.getElementById('borderWidth').value = "0";
    document.getElementById('codeColor').value = "black";
    document.getElementById('fontStyle').value = "font-hand";
    document.getElementById('progRange').value = "20";
    document.getElementById('inTime').value = "03:30";
    document.getElementById('link').value = "";
    document.getElementById('imgUpload').value = "";
    document.getElementById('cardSize').value = "350";

    // Ocultar portada
    removeCover();

    // Actualizar interfaz
    updateText();
    updateStyle();
    updateProgress();

    // Resetear código QR a default
    document.getElementById('code').src =
        "https://scannables.scdn.co/uri/plain/png/000000/white/800/spotify:track:5p7GiZKxLC2cisUKqLC0vW";

    showNotification('Configuración restablecida', 'info');
}

// 10. Descargar como PNG
function downloadPNG() {
    showNotification('Generando imagen...', 'info');

    html2canvas(card, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `spotify-card-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showNotification('Imagen descargada ✓', 'success');
    }).catch(error => {
        console.error("Error generando imagen:", error);
        showNotification('Error al descargar la imagen', 'error');
    });
}

// =============== FUNCIONES AUXILIARES ===============

// Mostrar notificaciones
function showNotification(message, type = 'info') {
    // Crear o reutilizar contenedor de notificaciones
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    // Crear notificación
    const notification = document.createElement('div');
    notification.style.cssText = `
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        max-width: 300px;
        word-break: break-word;
    `;

    // Colores según tipo
    const colors = {
        success: '#1db954',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };

    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;

    container.appendChild(notification);

    // Animación de entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);

    // Auto-eliminar después de 4 segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}