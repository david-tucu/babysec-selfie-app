/**
 * Única clase autorizada a modificar el DOM.
 * Renderiza pantallas según estado y expone eventos de usuario.
 */

import { AppState } from './StateManager.js';
import { canShareFiles } from './Utils.js';

export class UI {
  /**
   * @param {{ root?: HTMLElement }} [options]
   */
  constructor(options = {}) {
    this.#root = options.root ?? document.getElementById('app');
    if (!this.#root) {
      throw new Error('No se encontró el contenedor #app.');
    }

    this.#cacheElements();
    this.#updateShareHint();
  }

  /** @type {HTMLElement} */
  #root;

  /** @type {Record<string, HTMLElement>} */
  #el = {};

  /**
   * Referencia a elementos del DOM.
   */
  #cacheElements() {
    const ids = [
      'screen-landing',
      'screen-registration',
      'screen-camera',
      'screen-preview',
      'screen-finished',
      'screen-error',
      'canvas-container',
      'preview-video',
      'registration-form',
      'input-nombre',
      'input-apellido',
      'input-localidad',
      'input-email',
      'error-nombre',
      'error-apellido',
      'error-localidad',
      'error-email',
      'btn-start',
      'btn-continue',
      'btn-record',
      'btn-stop',
      'btn-retry',
      'btn-send',
      'btn-download',
      'btn-share',
      'btn-error-retry',
      'upload-overlay',
      'upload-message',
      'error-message',
      'finished-message',
      'share-hint',
      'countdown-display',
      'rec-display',
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) {
        this.#el[id] = element;
      }
    }
  }

  /**
   * Muestra u oculta hint de compartir según soporte del navegador.
   */
  #updateShareHint() {
    const shareBtn = this.#el['btn-share'];
    const hint = this.#el['share-hint'];

    if (shareBtn instanceof HTMLButtonElement) {
      shareBtn.disabled = false;
    }

    if (hint && !canShareFiles()) {
      hint.classList.remove('hidden');
    }
  }

  /**
   * Monta el canvas del Renderer en el contenedor de preview en vivo.
   * @param {HTMLCanvasElement} canvas
   */
  mountCanvas(canvas) {
    const container = this.#el['canvas-container'];
    container.innerHTML = '';
    canvas.classList.add('live-canvas');
    container.appendChild(canvas);
  }

  /**
   * Muestra la pantalla correspondiente al estado actual.
   * @param {string} state
   */
  showState(state) {
    // El formulario vive en screen-landing (ya no hay screen-registration).
    const screens = {
      [AppState.LANDING]: 'screen-landing',
      [AppState.REGISTRATION]: 'screen-landing',
      [AppState.CAMERA]: 'screen-camera',
      [AppState.COUNTDOWN]: 'screen-camera',
      [AppState.RECORDING]: 'screen-camera',
      [AppState.PREVIEW]: 'screen-preview',
      [AppState.UPLOADING]: 'screen-preview',
      [AppState.FINISHED]: 'screen-finished',
      [AppState.ERROR]: 'screen-error',
    };

    Object.values(screens).forEach((id) => {
      this.#el[id]?.classList.add('hidden');
    });

    const activeId = screens[state];
    this.#el[activeId]?.classList.remove('hidden');

    if (state === AppState.UPLOADING) {
      this.#el['upload-overlay']?.classList.remove('hidden');
    } else {
      this.#el['upload-overlay']?.classList.add('hidden');
    }

    const isLive = state === AppState.CAMERA;
    const isRecording = state === AppState.RECORDING;
    const isRecordingPhase = state === AppState.COUNTDOWN || isRecording;

    this.#setDisabled('btn-record', !isLive);
    this.#setHidden('btn-record', !isLive);
    this.#setHidden('btn-stop', !isRecording);
    this.#setHidden('countdown-display', !isRecordingPhase);
    this.#setHidden('rec-display', !isRecording);
  }

  /**
   * Lee los valores del formulario de registro.
   * @returns {{ nombre: string, apellido: string, localidad: string, email: string }}
   */
  getRegistrationInput() {
    return {
      nombre: this.#getInputValue('input-nombre'),
      apellido: this.#getInputValue('input-apellido'),
      localidad: this.#getInputValue('input-localidad'),
      email: this.#getInputValue('input-email'),
    };
  }

  /**
   * @param {string} id
   * @returns {string}
   */
  #getInputValue(id) {
    const el = this.#el[id];
    return el instanceof HTMLInputElement ? el.value : '';
  }

  /**
   * Muestra errores de validación en el formulario.
   * @param {Record<string, string>} errors
   */
  showRegistrationErrors(errors) {
    const fields = ['nombre', 'apellido', 'localidad', 'email'];

    fields.forEach((field) => {
      const errorEl = this.#el[`error-${field}`];
      const inputEl = this.#el[`input-${field}`];
      const message = errors[field];

      if (errorEl) {
        if (message) {
          errorEl.textContent = message;
          errorEl.classList.remove('hidden');
        } else {
          errorEl.textContent = '';
          errorEl.classList.add('hidden');
        }
      }

      if (inputEl instanceof HTMLInputElement) {
        inputEl.classList.toggle('form-input--error', Boolean(message));
      }
    });
  }

  /**
   * Limpia errores del formulario de registro.
   */
  clearRegistrationErrors() {
    this.showRegistrationErrors({});
  }

  /**
   * @param {string} id
   * @param {boolean} hidden
   */
  #setHidden(id, hidden) {
    const el = this.#el[id];
    if (!el) return;
    el.classList.toggle('hidden', hidden);
  }

  /**
   * @param {string} id
   * @param {boolean} disabled
   */
  #setDisabled(id, disabled) {
    const el = this.#el[id];
    if (el instanceof HTMLButtonElement) {
      el.disabled = disabled;
    }
  }

  /**
   * Habilita/deshabilita el botón Continuar del formulario.
   * @param {boolean} enabled
   */
  setContinueEnabled(enabled) {
    this.#setDisabled('btn-continue', !enabled);
  }

  /**
   * Actualiza indicadores DOM (countdown / REC / tiempo).
   * Van solo en pantalla; el canvas grabado no los incluye.
   * @param {{ countdown?: number|null, remainingSeconds?: number|null, showRec?: boolean }} payload
   */
  updateLiveIndicators(payload) {
    const countdownEl = this.#el['countdown-display'];
    const recEl = this.#el['rec-display'];

    if (countdownEl) {
      if (payload.countdown != null && payload.countdown > 0) {
        countdownEl.textContent = String(payload.countdown);
        countdownEl.classList.remove('hidden');
      } else if (payload.showRec && payload.remainingSeconds != null) {
        countdownEl.textContent = String(payload.remainingSeconds);
        countdownEl.classList.remove('hidden');
      } else {
        countdownEl.textContent = '';
        countdownEl.classList.add('hidden');
      }
    }

    if (recEl) {
      recEl.classList.toggle('hidden', !payload.showRec);
    }
  }

  /**
   * Asigna URL al video de previsualización.
   * @param {string} objectUrl
   */
  setPreviewUrl(objectUrl) {
    const video = this.#el['preview-video'];
    if (video instanceof HTMLVideoElement) {
      video.src = objectUrl;
      video.load();
    }
  }

  /**
   * Limpia el video de previsualización.
   */
  clearPreview() {
    const video = this.#el['preview-video'];
    if (video instanceof HTMLVideoElement) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  /**
   * Muestra mensaje durante la subida.
   * @param {string} message
   */
  setUploadMessage(message) {
    const el = this.#el['upload-message'];
    if (el) el.textContent = message;
  }

  /**
   * Muestra mensaje de error.
   * @param {string} message
   */
  showErrorMessage(message) {
    const el = this.#el['error-message'];
    if (el) el.textContent = message;
  }

  /**
   * Muestra pantalla de éxito con datos del servidor.
   * @param {{ message?: string, downloadUrl?: string, user?: { nombre?: string } }} data
   */
  showFinished(data) {
    const el = this.#el['finished-message'];
    const userName = data.user?.nombre;

    if (el) {
      el.textContent = userName
        ? `${userName}, tu video fue guardado correctamente.`
        : (data.message ?? 'Tu video fue guardado correctamente.');
    }

    if (data.downloadUrl) {
      this.#finishedDownloadUrl = data.downloadUrl;
    }
  }

  /** @type {string|null} */
  #finishedDownloadUrl = null;

  /**
   * @returns {string|null}
   */
  getFinishedDownloadUrl() {
    return this.#finishedDownloadUrl;
  }

  /**
   * Registra handlers de interacción del usuario.
   * @param {{
   *   onStart?: () => void,
   *   onRegistrationSubmit?: () => void,
   *   onRecord?: () => void,
   *   onStop?: () => void,
   *   onRetry?: () => void,
   *   onSend?: () => void,
   *   onDownload?: () => void,
   *   onShare?: () => void,
   *   onErrorRetry?: () => void,
   * }} handlers
   */
  bindHandlers(handlers) {
    this.#bindClick('btn-start', handlers.onStart);
    this.#bindClick('btn-record', handlers.onRecord);
    this.#bindClick('btn-stop', handlers.onStop);
    this.#bindClick('btn-retry', handlers.onRetry);
    this.#bindClick('btn-send', handlers.onSend);
    this.#bindClick('btn-download', handlers.onDownload);
    this.#bindClick('btn-share', handlers.onShare);
    this.#bindClick('btn-error-retry', handlers.onErrorRetry);

    const form = this.#el['registration-form'];
    if (form instanceof HTMLFormElement && handlers.onRegistrationSubmit) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        handlers.onRegistrationSubmit();
      });
    }
  }

  /**
   * @param {string} id
   * @param {(() => void)|undefined} handler
   */
  #bindClick(id, handler) {
    const el = this.#el[id];
    if (el && handler) {
      el.addEventListener('click', handler);
    }
  }
}
