/**
 * Grabación del canvas + audio del micrófono.
 * Control de duración basado en timestamps (performance.now), sin setTimeout.
 */

import {
  RECORD_DURATION_MS,
  RECORD_CUT_OFFSET_MS,
  COUNTDOWN_DURATION_MS,
  CAPTURE_FPS,
  RECORDER_VIDEO_CODEC,
  getSupportedMimeType,
  getRecorderMimeSupport,
  diagnoseRecordingBlob,
} from './Utils.js';
import fixWebmDuration from './vendor/fix-webm-duration.js';
import { makeSeekableWebm, canMakeSeekableWebm } from './makeSeekableWebm.js';

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

  /** @type {string|null} */
  #mimeTypeRequested = null;

  /** @type {number} */
  #chunkCount = 0;

  /** @type {number|null} */
  #recordingStartedAt = null;

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

      const mimeSupport = getRecorderMimeSupport();
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;

      this.#mediaRecorder = new MediaRecorder(combinedStream, options);
      this.#chunks = [];
      this.#chunkCount = 0;
      this.#discardResult = false;
      this.#mimeTypeRequested = mimeType || null;
      this.#recordingStartedAt = now;

      console.groupCollapsed('[babysec][video-diag] mediarecorder-start');
      console.log('RECORDER_VIDEO_CODEC:', RECORDER_VIDEO_CODEC);
      console.log('mimeType seleccionado:', this.#mimeTypeRequested);
      console.log(
        'isTypeSupported(preferido):',
        mimeSupport.support[mimeSupport.preferredMime],
        '→',
        mimeSupport.preferredMime,
      );
      console.log('MediaRecorder.mimeType (efectivo):', this.#mediaRecorder.mimeType);
      console.log('captureStream fps:', CAPTURE_FPS);
      console.log('canvas:', canvas.width, 'x', canvas.height);
      console.log('hasAudioTrack:', Boolean(audioTrack));
      // Sin timeslice: un solo blob al stop → remux seekable (Cues) más fiable.
      console.log('timeslice (ms):', null);
      console.log('videoBitsPerSecond set?:', false);
      console.log('canMakeSeekableWebm:', canMakeSeekableWebm());
      console.groupEnd();

      this.#mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.#chunks.push(event.data);
          this.#chunkCount += 1;
        }
      };

      this.#mediaRecorder.onstop = async () => {
        const recorderMime = this.#mediaRecorder?.mimeType || mimeType || 'video/webm';
        const chunkCount = this.#chunkCount;
        const chunksSnapshot = this.#chunks.slice();
        const mimeTypeRequested = this.#mimeTypeRequested;
        const elapsedMs = this.#recordingStartedAt != null
          ? performance.now() - this.#recordingStartedAt
          : null;
        const canvasEl = this.#renderer.getCanvas();
        const discard = this.#discardResult;

        console.groupCollapsed('[babysec][video-diag] mediarecorder-onstop');
        console.log('onstop fired. phase was recording → building Blob now');
        console.log('chunks received:', chunkCount);
        console.log('elapsedMs until onstop:', elapsedMs);
        console.log('recorder mimeType:', recorderMime);
        console.groupEnd();

        this.#phase = 'idle';
        this.#phaseStartTime = null;
        this.#discardResult = false;
        this.#mediaRecorder = null;
        this.#chunks = [];
        this.#chunkCount = 0;
        this.#recordingStartedAt = null;

        if (discard) {
          return;
        }

        const rawBlob = new Blob(chunksSnapshot, { type: recorderMime });
        if (rawBlob.size <= 0) {
          return;
        }

        // Chrome MediaRecorder omite Duration/Cues. Samsung Video Player necesita
        // Cues (seek index); fix-webm-duration solo alcanza para Duration.
        let blob = rawBlob;
        const durationMs = Number.isFinite(elapsedMs) && elapsedMs > 0
          ? elapsedMs
          : RECORD_DURATION_MS - RECORD_CUT_OFFSET_MS;

        try {
          if (canMakeSeekableWebm()) {
            blob = await makeSeekableWebm(rawBlob, { durationMs });
            console.log('[babysec][video-diag] webm remux seekable (ts-ebml Cues+Duration) ok');
          } else {
            throw new Error('EBML no disponible');
          }
        } catch (seekError) {
          console.warn('[babysec][video-diag] seekable remux failed; fallback duration-only', seekError);
          try {
            blob = await fixWebmDuration(rawBlob, durationMs, { logger: false });
            console.log('[babysec][video-diag] webm duration fixed with', durationMs, 'ms');
          } catch (error) {
            console.warn('[babysec][video-diag] webm duration fix failed; using raw blob', error);
            blob = rawBlob;
          }
        }

        console.groupCollapsed('[babysec][codec-test] resultado');
        console.log('RECORDER_VIDEO_CODEC:', RECORDER_VIDEO_CODEC);
        console.log('mimeType seleccionado:', mimeTypeRequested);
        console.log('MediaRecorder.mimeType (efectivo):', recorderMime);
        console.log('tamaño final del blob (bytes):', blob.size);
        console.groupEnd();

        diagnoseRecordingBlob({
          blob,
          mimeTypeRequested,
          mimeTypeRecorder: recorderMime,
          chunkCount,
          recordedElapsedMs: elapsedMs,
          canvasWidth: canvasEl.width,
          canvasHeight: canvasEl.height,
          stage: 'onstop-after-duration-fix',
        }).then((diag) => {
          console.groupCollapsed('[babysec][codec-test] duración');
          console.log('mimeType seleccionado:', mimeTypeRequested);
          console.log('tamaño final del blob (bytes):', blob.size);
          console.log(
            'duración detectada (sec):',
            diag?.durationSec ?? diag?.durationRaw ?? '(sin metadata)',
          );
          console.log('durationStatus:', diag?.durationStatus ?? 'n/a');
          console.groupEnd();
        }).catch((error) => {
          console.warn('[babysec][video-diag] diagnose failed:', error);
        });

        this.#onComplete(blob);
      };

      this.#mediaRecorder.onerror = () => {
        this.#onError(new Error('Error durante la grabación del video.'));
      };

      this.#mediaRecorder.start();
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
      console.log('[babysec][video-diag] calling mediaRecorder.stop(); state=', this.#mediaRecorder.state);
      this.#mediaRecorder.stop();
    } else {
      console.warn('[babysec][video-diag] stop() skipped; recorder missing or already inactive');
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
