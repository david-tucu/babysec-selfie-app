/**
 * Grabación del canvas + audio del micrófono.
 * Control de duración basado en timestamps (performance.now), sin setTimeout.
 */

import {
  RECORD_DURATION_MS,
  RECORD_CUT_OFFSET_MS,
  COUNTDOWN_DURATION_MS,
  CAPTURE_FPS,
  getSupportedMimeType,
} from './Utils.js';

export class Recorder {
  /** @type {import('./Renderer.js').Renderer} */
  #renderer;

  /** @type {import('./Camera.js').Camera} */
  #camera;

  /** @type {MediaRecorder|null} */
  #mediaRecorder = null;

  /** @type {Blob[]} */
  #chunks = [];

  /** @type {number|null} */
  #tickFrameId = null;

  /** @type {number|null} */
  #phaseStartTime = null;

  /** @type {'idle'|'countdown'|'recording'} */
  #phase = 'idle';

  /** @type {boolean} */
  #discardResult = false;

  /**
   * @param {{
   *   renderer: import('./Renderer.js').Renderer,
   *   camera: import('./Camera.js').Camera,
   *   onTick?: (payload: { phase: string, countdown: number|null, remainingSeconds: number|null }) => void,
   *   onComplete?: (blob: Blob) => void,
   *   onError?: (error: Error) => void,
   * }} options
   */
  constructor(options) {
    this.#renderer = options.renderer;
    this.#camera = options.camera;
    this.#onTick = options.onTick ?? (() => {});
    this.#onComplete = options.onComplete ?? (() => {});
    this.#onError = options.onError ?? (() => {});
  }

  /** @type {(payload: { phase: string, countdown: number|null, remainingSeconds: number|null }) => void} */
  #onTick;

  /** @type {(blob: Blob) => void} */
  #onComplete;

  /** @type {(error: Error) => void} */
  #onError;

  /**
   * Inicia cuenta regresiva (3,2,1) y luego la grabación configurada.
   */
  start() {
    if (this.#phase !== 'idle') {
      return;
    }

    this.#discardResult = false;
    this.#phase = 'countdown';
    this.#phaseStartTime = performance.now();
    this.#tick();
  }

  /**
   * Detiene la grabación en curso y entrega el video parcial.
   */
  stop() {
    if (this.#phase !== 'recording') {
      return;
    }

    this.#discardResult = false;
    this.#stopRecording();
  }

  /**
   * Cancela grabación en curso y libera recursos (sin entregar video).
   */
  cancel() {
    this.#discardResult = true;
    this.#stopTickLoop();

    if (this.#mediaRecorder && this.#mediaRecorder.state !== 'inactive') {
      this.#mediaRecorder.stop();
    }

    this.#mediaRecorder = null;
    this.#chunks = [];
    this.#phase = 'idle';
    this.#phaseStartTime = null;
  }

  /**
   * Loop principal basado en requestAnimationFrame + timestamps.
   */
  #tick = () => {
    const now = performance.now();

    if (this.#phase === 'countdown') {
      const elapsed = now - (this.#phaseStartTime ?? now);
      const remainingMs = COUNTDOWN_DURATION_MS - elapsed;
      const countdown = Math.ceil(remainingMs / 1000);

      // Countdown solo en DOM (UI); no se dibuja en el canvas grabado.
      this.#onTick({ phase: 'countdown', countdown: countdown > 0 ? countdown : null, remainingSeconds: null });

      if (remainingMs <= 0) {
        this.#beginRecording(now);
        return;
      }
    }

    if (this.#phase === 'recording') {
      const elapsed = now - (this.#phaseStartTime ?? now);
      const remainingMs = RECORD_DURATION_MS - elapsed;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const cutAtMs = RECORD_DURATION_MS - RECORD_CUT_OFFSET_MS;

      // REC / tiempo restante solo en DOM; el video queda limpio.
      this.#onTick({
        phase: 'recording',
        countdown: null,
        remainingSeconds: remainingSeconds > 0 ? remainingSeconds : 0,
      });

      // Corte automático con offset (1s antes del final configurado).
      if (elapsed >= cutAtMs) {
        this.#stopRecording();
        return;
      }
    }

    this.#tickFrameId = requestAnimationFrame(this.#tick);
  };

  /**
   * Arranca MediaRecorder tras la cuenta regresiva.
   * @param {number} now
   */
  #beginRecording(now) {
    try {
      const canvas = this.#renderer.getCanvas();
      const canvasStream = canvas.captureStream(CAPTURE_FPS);
      const audioTrack = this.#camera.getAudioTrack();

      // Combinar video del canvas con audio del micrófono
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioTrack ? [audioTrack] : []),
      ]);

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;

      this.#mediaRecorder = new MediaRecorder(combinedStream, options);
      this.#chunks = [];
      this.#discardResult = false;

      this.#mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.#chunks.push(event.data);
        }
      };

      this.#mediaRecorder.onstop = () => {
        const type = this.#mediaRecorder?.mimeType || mimeType || 'video/webm';
        const blob = new Blob(this.#chunks, { type });
        const discard = this.#discardResult;

        this.#phase = 'idle';
        this.#phaseStartTime = null;
        this.#discardResult = false;
        this.#mediaRecorder = null;
        this.#chunks = [];

        if (!discard && blob.size > 0) {
          this.#onComplete(blob);
        }
      };

      this.#mediaRecorder.onerror = () => {
        this.#onError(new Error('Error durante la grabación del video.'));
      };

      this.#mediaRecorder.start(250);
      this.#phase = 'recording';
      this.#phaseStartTime = now;
    } catch (error) {
      this.#onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    this.#tickFrameId = requestAnimationFrame(this.#tick);
  }

  /**
   * Detiene MediaRecorder (fin automático o stop manual).
   */
  #stopRecording() {
    this.#stopTickLoop();

    if (this.#mediaRecorder && this.#mediaRecorder.state !== 'inactive') {
      this.#mediaRecorder.stop();
    }
  }

  /**
   * Cancela el loop de ticks.
   */
  #stopTickLoop() {
    if (this.#tickFrameId !== null) {
      cancelAnimationFrame(this.#tickFrameId);
      this.#tickFrameId = null;
    }
  }
}
