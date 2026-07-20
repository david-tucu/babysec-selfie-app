/**
 * Registro de participante y subida de video vía FormData.
 * La subida usa XHR para exponer progreso y fases (fetch no reporta upload progress).
 */

import { generateFilename } from './Utils.js';

/**
 * @typedef {{
 *   phase: 'preparing'|'uploading'|'waiting_server'|'parsing'|'done'|'error',
 *   percent: number|null,
 *   loaded?: number,
 *   total?: number,
 *   elapsedMs: number,
 *   message: string,
 * }} UploadProgress
 */

/** Mensajes rotativos mientras PHP procesa (cada 8s). */
const WAITING_SERVER_HINTS = [
  'Esto puede tardar',
  'Espera unos segundos más',
  'El video se sigue procesando',
];

const WAITING_SERVER_HINT_MS = 8_000;

/** Reintentos ante 408 / red (el body a veces no llega completo en móvil lento). */
const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_RETRY_DELAY_MS = 1_200;

export class Uploader {
  /**
   * @param {{ registerEndpoint?: string, uploadEndpoint?: string }} [options]
   */
  constructor(options = {}) {
    this.#registerEndpoint = options.registerEndpoint ?? 'api/register.php';
    this.#uploadEndpoint = options.uploadEndpoint ?? 'api/upload.php';
  }

  /** @type {string} */
  #registerEndpoint;

  /** @type {string} */
  #uploadEndpoint;

  /**
   * Registra al participante y obtiene un UUID.
   * @param {{ nombre: string, apellido: string, localidad: string, email: string }} userData
   * @returns {Promise<{ success: boolean, uuid: string, message?: string }>}
   */
  async register(userData) {
    const formData = new FormData();
    formData.append('nombre', userData.nombre);
    formData.append('apellido', userData.apellido);
    formData.append('localidad', userData.localidad);
    formData.append('email', userData.email);

    const data = await this.#postForm(this.#registerEndpoint, formData, 'No se pudo registrar.');

    if (!data.uuid || typeof data.uuid !== 'string') {
      throw new Error('El servidor no devolvió un UUID válido.');
    }

    return data;
  }

  /**
   * Sube el video asociado a un participante ya registrado.
   * Reintenta ante timeout (408) / red: el registro queda `registered`/`failed` y admite reintento.
   * @param {Blob} blob
   * @param {string} uuid
   * @param {string} [filename]
   * @param {{ onProgress?: (progress: UploadProgress) => void }} [options]
   * @returns {Promise<{ success: boolean, filename?: string, url?: string, downloadUrl?: string, message?: string }>}
   */
  async upload(blob, uuid, filename = generateFilename(), options = {}) {
    const onProgress = options.onProgress ?? (() => {});
    let lastError = new Error('No se pudo subir el video.');

    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        if (attempt > 1) {
          onProgress({
            phase: 'preparing',
            percent: 0,
            loaded: 0,
            total: blob.size,
            elapsedMs: 0,
            message: `Reintentando subida (${attempt}/${UPLOAD_MAX_ATTEMPTS})...`,
          });
          console.warn(`[babysec][upload] retry ${attempt}/${UPLOAD_MAX_ATTEMPTS}`);
          await delay(UPLOAD_RETRY_DELAY_MS);
        }

        return await this.#uploadOnce(blob, uuid, filename, onProgress, attempt);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable = Boolean(/** @type {{ retryable?: boolean }} */ (lastError).retryable);
        if (!retryable || attempt >= UPLOAD_MAX_ATTEMPTS) {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  /**
   * @param {Blob} blob
   * @param {string} uuid
   * @param {string} filename
   * @param {(progress: UploadProgress) => void} onProgress
   * @param {number} attempt
   */
  #uploadOnce(blob, uuid, filename, onProgress, attempt) {
    const formData = new FormData();
    formData.append('uuid', uuid);
    formData.append('video', blob, filename);

    const startedAt = performance.now();
    /** @type {Record<string, number|null>} */
    const marks = {
      preparing: startedAt,
      uploading: null,
      waiting_server: null,
      parsing: null,
      done: null,
    };

    const emit = (partial) => {
      const elapsedMs = Math.round(performance.now() - startedAt);
      onProgress({ elapsedMs, ...partial });
    };

    emit({
      phase: 'preparing',
      percent: 0,
      loaded: 0,
      total: blob.size,
      message: attempt > 1
        ? `Reintentando subida (${attempt}/${UPLOAD_MAX_ATTEMPTS})...`
        : 'Preparando subida...',
    });

    console.groupCollapsed(`[babysec][upload] start (attempt ${attempt})`);
    console.log('endpoint:', this.#uploadEndpoint);
    console.log('filename:', filename);
    console.log('blob.type:', blob.type);
    console.log('blob.size (bytes):', blob.size);
    console.log('uuid:', uuid);
    console.groupEnd();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.#uploadEndpoint);
      xhr.responseType = 'text';

      /** @type {ReturnType<typeof setInterval>|null} */
      let waitingHintTimer = null;
      let waitingHintIndex = 0;

      const stopWaitingHints = () => {
        if (waitingHintTimer != null) {
          clearInterval(waitingHintTimer);
          waitingHintTimer = null;
        }
      };

      const startWaitingHints = () => {
        stopWaitingHints();
        waitingHintIndex = 0;
        waitingHintTimer = setInterval(() => {
          const hint = WAITING_SERVER_HINTS[waitingHintIndex % WAITING_SERVER_HINTS.length];
          waitingHintIndex += 1;
          emit({
            phase: 'waiting_server',
            percent: 100,
            loaded: blob.size,
            total: blob.size,
            message: hint,
          });
        }, WAITING_SERVER_HINT_MS);
      };

      /**
       * @param {string} message
       * @param {{ retryable?: boolean, httpStatus?: number }} [meta]
       */
      const fail = (message, meta = {}) => {
        stopWaitingHints();
        marks.done = performance.now();
        const report = this.#finishReport(marks, startedAt, blob, {
          phase: 'error',
          httpStatus: meta.httpStatus ?? xhr.status,
          ok: false,
          error: message,
          attempt,
          retryable: Boolean(meta.retryable),
        });
        globalThis.__BABYSEC_LAST_UPLOAD__ = report;
        console.warn('[babysec][upload] fail', report);
        emit({
          phase: 'error',
          percent: null,
          message,
        });
        const err = new Error(message);
        /** @type {{ retryable?: boolean }} */ (err).retryable = Boolean(meta.retryable);
        reject(err);
      };

      xhr.upload.addEventListener('loadstart', () => {
        marks.uploading = performance.now();
        emit({
          phase: 'uploading',
          percent: 0,
          loaded: 0,
          total: blob.size,
          message: 'Subiendo video... 0%',
        });
        console.log('[babysec][upload] phase → uploading');
      });

      xhr.upload.addEventListener('progress', (event) => {
        if (!marks.uploading) {
          marks.uploading = performance.now();
        }

        if (!event.lengthComputable) {
          emit({
            phase: 'uploading',
            percent: null,
            loaded: event.loaded,
            message: 'Subiendo video...',
          });
          return;
        }

        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        emit({
          phase: 'uploading',
          percent,
          loaded: event.loaded,
          total: event.total,
          message: `Subiendo video... ${percent}%`,
        });
      });

      xhr.upload.addEventListener('load', () => {
        marks.waiting_server = performance.now();
        emit({
          phase: 'waiting_server',
          percent: 100,
          loaded: blob.size,
          total: blob.size,
          message: 'Procesando en el servidor...',
        });
        startWaitingHints();
        console.log('[babysec][upload] phase → waiting_server (bytes enviados; esperando respuesta PHP)');
      });

      xhr.addEventListener('load', () => {
        stopWaitingHints();
        marks.parsing = performance.now();
        emit({
          phase: 'parsing',
          percent: 100,
          message: 'Leyendo respuesta...',
        });

        const status = xhr.status;
        let data;
        try {
          data = JSON.parse(xhr.responseText || '');
        } catch {
          const message = messageForHttpStatus(status, 'Respuesta inválida del servidor.');
          fail(message, {
            httpStatus: status,
            retryable: isRetryableStatus(status) || status === 0,
          });
          return;
        }

        const ok = status >= 200 && status < 300 && data?.success === true;
        marks.done = performance.now();

        const report = this.#finishReport(marks, startedAt, blob, {
          phase: ok ? 'done' : 'error',
          httpStatus: status,
          ok,
          error: ok ? null : (data?.message || messageForHttpStatus(status, 'No se pudo subir el video.')),
          serverMessage: data?.message ?? null,
          attempt,
        });

        console.groupCollapsed('[babysec][upload] timings');
        console.log('attempt:', attempt);
        console.log('preparing → uploading (ms):', report.phaseMs.preparing);
        console.log('uploading bytes (ms):', report.phaseMs.uploading);
        console.log('waiting_server (ms):', report.phaseMs.waiting_server);
        console.log('parsing (ms):', report.phaseMs.parsing);
        console.log('TOTAL (ms):', report.totalMs);
        console.log('httpStatus:', report.httpStatus);
        console.log('ok:', report.ok);
        if (!ok) console.warn('error:', report.error);
        console.groupEnd();

        globalThis.__BABYSEC_LAST_UPLOAD__ = report;

        if (!ok) {
          const message = report.error || 'No se pudo subir el video.';
          emit({
            phase: 'error',
            percent: null,
            message,
          });
          const err = new Error(message);
          /** @type {{ retryable?: boolean }} */ (err).retryable = isRetryableStatus(status);
          reject(err);
          return;
        }

        emit({
          phase: 'done',
          percent: 100,
          message: 'Video subido.',
        });
        resolve(data);
      });

      xhr.addEventListener('error', () => {
        fail('Error de red al subir el video. Revisá la señal e intentá de nuevo.', {
          httpStatus: xhr.status,
          retryable: true,
        });
      });

      xhr.addEventListener('abort', () => {
        fail('Subida cancelada.', { retryable: false });
      });

      xhr.addEventListener('timeout', () => {
        fail('La subida tardó demasiado. Intentá de nuevo con mejor señal.', {
          retryable: true,
        });
      });

      // Margen alto: el 408 lo corta el proxy del hosting, no el XHR por defecto.
      xhr.timeout = 180_000;
      xhr.send(formData);
    });
  }

  /**
   * @param {Record<string, number|null>} marks
   * @param {number} startedAt
   * @param {Blob} blob
   * @param {object} extra
   */
  #finishReport(marks, startedAt, blob, extra) {
    const end = marks.done ?? performance.now();
    const ms = (from, to) => {
      if (from == null || to == null) return null;
      return Math.round(to - from);
    };

    return {
      ...extra,
      blobSizeBytes: blob.size,
      blobType: blob.type,
      totalMs: Math.round(end - startedAt),
      phaseMs: {
        preparing: ms(marks.preparing, marks.uploading ?? end),
        uploading: ms(marks.uploading, marks.waiting_server ?? end),
        waiting_server: ms(marks.waiting_server, marks.parsing ?? end),
        parsing: ms(marks.parsing, marks.done ?? end),
      },
      marks,
    };
  }

  /**
   * @param {string} endpoint
   * @param {FormData} formData
   * @param {string} fallbackMessage
   * @returns {Promise<object>}
   */
  async #postForm(endpoint, formData, fallbackMessage) {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error('Respuesta inválida del servidor.');
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || fallbackMessage);
    }

    return data;
  }
}

/**
 * @param {number} status
 */
function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429
    || status === 502 || status === 503 || status === 504;
}

/**
 * @param {number} status
 * @param {string} fallback
 */
function messageForHttpStatus(status, fallback) {
  if (status === 408) {
    return 'La conexión fue lenta y el servidor cortó la subida. Intentá de nuevo con mejor señal Wi‑Fi.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'El servidor no respondió a tiempo. Intentá de nuevo en unos segundos.';
  }
  if (status === 413) {
    return 'El video es demasiado grande para el servidor.';
  }
  return fallback;
}

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
