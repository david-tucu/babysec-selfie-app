/**
 * Utilidades compartidas de babysec-selfie.
 * Funciones puras reutilizables por cualquier módulo.
 */

/** Configuración de grabación (segundos). */
export const RECORD_DURATION_SECONDS = 20;

/**
 * Offset del corte automático (ms).
 * El stop se dispara 1 segundo antes de completar la duración configurada.
 */
export const RECORD_CUT_OFFSET_MS = 1_000;

/** Duración de grabación en milisegundos (derivada de la config). */
export const RECORD_DURATION_MS = RECORD_DURATION_SECONDS * 1_000;

/** Duración de cuenta regresiva previa en milisegundos (3 segundos). */
export const COUNTDOWN_DURATION_MS = 3_000;

/** Resolución del canvas de renderizado. */
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

/**
 * Zona visible del marco (px), relativa al canvas 1080×1920.
 * Rectángulo 860×1340 centrado en (540, 888).
 */
export const FRAME_VIEWPORT = {
  width: 860,
  height: 1340,
  centerX: 540,
  centerY: 888,
};

/** FPS de captura del canvas para MediaRecorder. */
export const CAPTURE_FPS = 30;

/**
 * Rectángulo destino donde se dibuja la cámara (agujero del marco).
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function getFrameViewportRect() {
  return {
    x: FRAME_VIEWPORT.centerX - FRAME_VIEWPORT.width / 2,
    y: FRAME_VIEWPORT.centerY - FRAME_VIEWPORT.height / 2,
    width: FRAME_VIEWPORT.width,
    height: FRAME_VIEWPORT.height,
  };
}

/**
 * Genera un nombre de archivo único para el video.
 * @returns {string}
 */
export function generateFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).slice(2, 8);
  return `babysec-selfie-${stamp}-${random}.webm`;
}

/**
 * Formatea segundos enteros para mostrar en pantalla.
 * @param {number} seconds
 * @returns {string}
 */
export function formatSeconds(seconds) {
  return String(Math.max(0, Math.ceil(seconds)));
}

/**
 * Descarga un Blob en el dispositivo del usuario.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Comprueba si el navegador soporta Web Share API con archivos.
 * @returns {boolean}
 */
export function canShareFiles() {
  return (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

/**
 * Intenta compartir un archivo de video vía Web Share API.
 * @param {Blob} blob
 * @param {string} filename
 * @param {string} [title]
 * @returns {Promise<boolean>} true si se compartió correctamente
 */
export async function shareVideo(blob, filename, title = 'Mi selfie video') {
  if (!canShareFiles()) {
    return false;
  }

  const file = new File([blob], filename, { type: blob.type || 'video/webm' });
  const payload = { files: [file], title, text: title };

  if (!navigator.canShare(payload)) {
    return false;
  }

  await navigator.share(payload);
  return true;
}

/**
 * Carga una imagen de forma asíncrona.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`));
    img.src = src;
  });
}

/**
 * Calcula dimensiones object-fit: cover para dibujar video en canvas.
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @returns {{ sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number }}
 */
export function computeCoverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  let sw = sourceWidth;
  let sh = sourceHeight;
  let sx = 0;
  let sy = 0;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  return {
    sx,
    sy,
    sw,
    sh,
    dx: 0,
    dy: 0,
    dw: targetWidth,
    dh: targetHeight,
  };
}

/**
 * Espera un frame de animación (útil para sincronizar canvas).
 * @returns {Promise<number>}
 */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * Valida formato de correo electrónico.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Valida y normaliza datos de registro del usuario.
 * @param {{ nombre?: string, apellido?: string, localidad?: string, email?: string }} data
 * @returns {{ valid: boolean, errors: Record<string, string>, data: { nombre: string, apellido: string, localidad: string, email: string } }}
 */
export function validateRegistration(data) {
  const nombre = (data.nombre ?? '').trim().toUpperCase();
  const apellido = (data.apellido ?? '').trim().toUpperCase();
  const localidad = (data.localidad ?? '').trim().toUpperCase();
  const email = (data.email ?? '').trim().toLowerCase();
  const errors = {};

  if (nombre.length < 2) {
    errors.nombre = 'Ingresá tu nombre (mínimo 2 caracteres).';
  }

  if (apellido.length < 2) {
    errors.apellido = 'Ingresá tu apellido (mínimo 2 caracteres).';
  }

  if (localidad.length < 2) {
    errors.localidad = 'Ingresá tu localidad (mínimo 2 caracteres).';
  }

  if (!email) {
    errors.email = 'Ingresá tu correo electrónico.';
  } else if (!isValidEmail(email)) {
    errors.email = 'El correo electrónico no es válido.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: { nombre, apellido, localidad, email },
  };
}

/**
 * Descarga un archivo desde una URL del servidor.
 * @param {string} url
 * @param {string} filename
 */
export async function downloadFromUrl(url, filename) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudo descargar el video.');
  }
  const blob = await response.blob();
  downloadBlob(blob, filename);
}

/**
 * Intenta compartir el video en redes sociales vía Web Share API.
 * @param {Blob} blob
 * @param {string} filename
 * @param {{ nombre?: string, apellido?: string }} [user]
 * @returns {Promise<boolean>}
 */
export async function shareVideoToSocial(blob, filename, user = {}) {
  const displayName = [user.nombre, user.apellido].filter(Boolean).join(' ').trim();
  const title = displayName
    ? `${displayName} — babysec-selfie`
    : 'Mi selfie del evento';
  const text = '¡Mirá mi video del evento! 🎬';

  if (!canShareFiles()) {
    return false;
  }

  const file = new File([blob], filename, { type: blob.type || 'video/webm' });
  const payload = { files: [file], title, text };

  if (!navigator.canShare(payload)) {
    return false;
  }

  await navigator.share(payload);
  return true;
}

/**
 * Obtiene el MIME type soportado por MediaRecorder.
 * @returns {string}
 */
export function getSupportedMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
}
