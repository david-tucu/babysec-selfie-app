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
 * Preferencia de codec para MediaRecorder (prueba de compatibilidad).
 * - 'vp9' → video/webm;codecs=vp9,opus (default histórico)
 * - 'vp8' → video/webm;codecs=vp8,opus (alternativa a comparar)
 * Cambiar solo este valor; el resto del flujo no se altera.
 * @type {'vp9'|'vp8'}
 */
export const RECORDER_VIDEO_CODEC = 'vp9';

/** MIME exactos usados en la prueba VP9 vs VP8. */
export const RECORDER_MIME_BY_CODEC = {
  vp9: 'video/webm;codecs=vp9,opus',
  vp8: 'video/webm;codecs=vp8,opus',
};

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
 * Normaliza MIME de video para Web Share (Android suele rechazar codecs=...).
 * @param {string|undefined} type
 * @returns {string}
 */
export function normalizeShareMimeType(type) {
  const raw = (type || 'video/webm').toLowerCase().trim();
  const base = raw.split(';')[0].trim();
  if (base === 'video/webm' || base === 'video/mp4' || base === 'video/ogg') {
    return base;
  }
  return 'video/webm';
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
  const text = '¡Mirá mi video del evento!';

  if (!canShareFiles()) {
    return false;
  }

  const mime = normalizeShareMimeType(blob.type);
  const file = new File([blob], filename.replace(/\.[^.]+$/, '') + (
    mime === 'video/mp4' ? '.mp4' : mime === 'video/ogg' ? '.ogg' : '.webm'
  ), { type: mime });
  const payload = { files: [file], title, text };

  if (!navigator.canShare(payload)) {
    return false;
  }

  try {
    await navigator.share(payload);
    return true;
  } catch (error) {
    // Usuario canceló el sheet: no es error de app.
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    // NotAllowedError / permission: WebM u origen no permitido en ese Android.
    if (error instanceof Error && (error.name === 'NotAllowedError' || /permission/i.test(error.message))) {
      const denied = new Error(
        'Este dispositivo no permite compartir este video desde el navegador. Usá Descargar y subilo desde la galería.',
      );
      denied.name = 'ShareNotAllowedError';
      throw denied;
    }
    throw error;
  }
}

/**
 * Matriz isTypeSupported para los MIME de la prueba de codec.
 * @returns {{ preferred: 'vp9'|'vp8', preferredMime: string, support: Record<string, boolean> }}
 */
export function getRecorderMimeSupport() {
  const preferred = RECORDER_VIDEO_CODEC === 'vp8' ? 'vp8' : 'vp9';
  const preferredMime = RECORDER_MIME_BY_CODEC[preferred];
  const support = {};

  for (const mime of Object.values(RECORDER_MIME_BY_CODEC)) {
    support[mime] = typeof MediaRecorder !== 'undefined'
      && typeof MediaRecorder.isTypeSupported === 'function'
      && MediaRecorder.isTypeSupported(mime);
  }

  return { preferred, preferredMime, support };
}

/**
 * Obtiene el MIME type soportado por MediaRecorder.
 * Respeta RECORDER_VIDEO_CODEC; si el preferido no está soportado, cae al otro / genéricos.
 * @returns {string}
 */
export function getSupportedMimeType() {
  const { preferred, preferredMime, support } = getRecorderMimeSupport();

  const preferredFirst = preferred === 'vp8'
    ? [RECORDER_MIME_BY_CODEC.vp8, RECORDER_MIME_BY_CODEC.vp9]
    : [RECORDER_MIME_BY_CODEC.vp9, RECORDER_MIME_BY_CODEC.vp8];

  const candidates = [
    ...preferredFirst,
    'video/webm',
    'video/mp4',
  ];

  console.groupCollapsed('[babysec][codec-test] mime selection');
  console.log('RECORDER_VIDEO_CODEC (config):', preferred);
  console.log('preferred mimeType:', preferredMime);
  for (const [mime, ok] of Object.entries(support)) {
    console.log(`MediaRecorder.isTypeSupported(${JSON.stringify(mime)}):`, ok);
  }

  let selected = '';
  for (const type of candidates) {
    const ok = typeof MediaRecorder !== 'undefined'
      && typeof MediaRecorder.isTypeSupported === 'function'
      && MediaRecorder.isTypeSupported(type);
    if (ok) {
      selected = type;
      break;
    }
  }

  console.log('mimeType seleccionado:', selected || '(ninguno / default browser)');
  console.groupEnd();

  return selected;
}

/**
 * Diagnostico de un Blob de video (solo consola; no altera el flujo).
 * @param {{
 *   blob: Blob,
 *   mimeTypeRequested?: string|null,
 *   mimeTypeRecorder?: string|null,
 *   chunkCount?: number,
 *   recordedElapsedMs?: number|null,
 *   canvasWidth?: number|null,
 *   canvasHeight?: number|null,
 *   stage?: string,
 * }} input
 * @returns {Promise<object>}
 */
export async function diagnoseRecordingBlob(input) {
  const {
    blob,
    mimeTypeRequested = null,
    mimeTypeRecorder = null,
    chunkCount = null,
    recordedElapsedMs = null,
    canvasWidth = null,
    canvasHeight = null,
    stage = 'post-blob',
  } = input;

  const report = {
    stage,
    mimeTypeRequested,
    mimeTypeRecorder,
    blobType: blob?.type ?? null,
    blobSizeBytes: blob?.size ?? 0,
    chunkCount,
    recordedElapsedMs,
    canvasWidth,
    canvasHeight,
    videoWidth: null,
    videoHeight: null,
    durationSec: null,
    durationRaw: null,
    durationStatus: 'unknown',
    bitrateEstimatedBps: null,
    problemStage: null,
  };

  console.groupCollapsed(`[babysec][video-diag] ${stage}`);
  console.log('mimeTypeRequested:', mimeTypeRequested);
  console.log('mediaRecorder.mimeType:', mimeTypeRecorder);
  console.log('blob.type:', report.blobType);
  console.log('blob.size (bytes):', report.blobSizeBytes);
  console.log('chunkCount:', chunkCount);
  console.log('recordedElapsedMs (app timer):', recordedElapsedMs);
  console.log('canvas resolution:', canvasWidth, 'x', canvasHeight);

  if (!blob || blob.size <= 0) {
    report.durationStatus = 'empty-blob';
    report.problemStage = 'blob-construction';
    console.warn('PROBLEMA: Blob vacio o ausente en etapa', report.problemStage);
    console.groupEnd();
    return report;
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    const meta = await new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const finish = (payload) => {
        video.removeAttribute('src');
        video.load();
        resolve(payload);
      };

      video.addEventListener('loadedmetadata', () => {
        finish({
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          event: 'loadedmetadata',
        });
      });

      video.addEventListener('error', () => {
        finish({
          duration: NaN,
          videoWidth: 0,
          videoHeight: 0,
          readyState: video.readyState,
          event: 'error',
          mediaError: video.error ? {
            code: video.error.code,
            message: video.error.message,
          } : null,
        });
      });

      // Timeout por si metadata nunca llega.
      window.setTimeout(() => {
        finish({
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          event: 'timeout',
        });
      }, 4000);

      video.src = objectUrl;
    });

    report.durationRaw = meta.duration;
    report.videoWidth = meta.videoWidth || canvasWidth;
    report.videoHeight = meta.videoHeight || canvasHeight;

    if (Number.isNaN(meta.duration)) {
      report.durationStatus = 'NaN';
      report.problemStage = 'webm-metadata-duration';
    } else if (meta.duration === Infinity) {
      report.durationStatus = 'Infinity';
      report.problemStage = 'webm-metadata-duration';
    } else if (!meta.duration || meta.duration <= 0) {
      report.durationStatus = 'zero-or-missing';
      report.problemStage = 'webm-metadata-duration';
    } else {
      report.durationStatus = 'ok';
      report.durationSec = meta.duration;
    }

    const durationForBitrate =
      typeof report.durationSec === 'number' && report.durationSec > 0
        ? report.durationSec
        : (typeof recordedElapsedMs === 'number' && recordedElapsedMs > 0
          ? recordedElapsedMs / 1000
          : null);

    if (durationForBitrate) {
      report.bitrateEstimatedBps = Math.round((blob.size * 8) / durationForBitrate);
    }

    console.log('video element event:', meta.event);
    console.log('video.duration (raw):', meta.duration);
    console.log('durationStatus:', report.durationStatus);
    console.log('durationSec (parsed):', report.durationSec);
    console.log('video resolution:', report.videoWidth, 'x', report.videoHeight);
    console.log('bitrate estimado (bps):', report.bitrateEstimatedBps);
    console.log('bitrate estimado (kbps):',
      report.bitrateEstimatedBps != null
        ? Math.round(report.bitrateEstimatedBps / 1000)
        : null);

    if (report.problemStage) {
      console.warn(
        `PROBLEMA: duration=${String(meta.duration)} detectado en etapa "${report.problemStage}". ` +
        'Chrome MediaRecorder WebM suele omitir Duration/Cues; Gallery/Instagram fallan aunque Chrome reproduzca.',
      );
    } else {
      console.log('Duration metadata OK segun <video>.');
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
    console.groupEnd();
  }

  // Exponer ultimo reporte para inspeccion manual en DevTools.
  globalThis.__BABYSEC_LAST_VIDEO_DIAG__ = report;
  return report;
}
