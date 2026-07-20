/**
 * Punto de entrada de la aplicación.
 * Orquesta StateManager, Camera, Renderer, Recorder, Preview, Uploader y UI.
 */

import { StateManager, AppState } from './StateManager.js';
import { Camera } from './Camera.js';
import { Renderer } from './Renderer.js';
import { Recorder } from './Recorder.js';
import { Preview } from './Preview.js';
import { Uploader } from './Uploader.js';
import { UI } from './UI.js';
import {
  downloadBlob,
  downloadFromUrl,
  shareVideoToSocial,
  generateFilename,
  validateRegistration,
  canShareFiles,
} from './Utils.js';

class BabysecSelfieApp {
  constructor() {
    this.stateManager = new StateManager();
    this.camera = new Camera();
    this.renderer = new Renderer();
    this.ui = new UI();

    this.preview = new Preview({
      onReady: (url) => {
        this.ui.setPreviewUrl(url);
      },
      onCleared: () => {
        this.ui.clearPreview();
      },
    });

    this.uploader = new Uploader();

    this.recorder = new Recorder({
      renderer: this.renderer,
      camera: this.camera,
      onTick: (payload) => this.#onRecorderTick(payload),
      onComplete: (blob) => this.#handleRecordingComplete(blob),
      onError: (error) => this.#handleError(error.message),
    });

    /** @type {Blob|null} */
    this.#lastBlob = null;

    /** @type {string} */
    this.#lastFilename = generateFilename();

    /** @type {{ nombre: string, apellido: string, localidad: string, email: string }|null} */
    this.#userData = null;

    /** @type {string|null} */
    this.#participantUuid = null;

    /** @type {object|null} */
    this.#uploadResult = null;

    /** @type {boolean} */
    this.#registering = false;
  }

  /** @type {Blob|null} */
  #lastBlob;

  /** @type {string} */
  #lastFilename;

  /** @type {{ nombre: string, apellido: string, localidad: string, email: string }|null} */
  #userData;

  /** @type {string|null} */
  #participantUuid;

  /** @type {object|null} */
  #uploadResult;

  /** @type {boolean} */
  #registering;

  /** @type {boolean} */
  #starting = false;

  async init() {
    await this.renderer.loadAssets();
    this.ui.mountCanvas(this.renderer.getCanvas());
    this.ui.bindHandlers({
      onStart: () => this.#handleStart(),
      onBackHome: () => this.#handleBackHome(),
      onRegistrationSubmit: () => this.#handleRegistrationSubmit(),
      onRecord: () => this.#handleRecord(),
      onStop: () => this.#handleStop(),
      onRetry: () => this.#handleRetry(),
      onSend: () => this.#handleSend(),
      onDownload: () => this.#handleDownload(),
      onShare: () => this.#handleShare(),
      onErrorRetry: () => this.#handleErrorRetry(),
    });

    this.stateManager.subscribe((state) => {
      this.ui.showState(state);
    });

    // Historial interno: en Android "atras" vuelve a la portada en vez de salir.
    this.#setupHistoryNavigation();

    // Estado inicial ya es LANDING: mostrar y animar entrada.
    this.ui.showState(AppState.LANDING);
  }

  #setupHistoryNavigation() {
    history.replaceState({ app: 'babysec', screen: 'landing' }, '');

    window.addEventListener('popstate', (event) => {
      const screen = event.state?.screen;

      if (screen === 'registration') {
        this.stateManager.setState(AppState.REGISTRATION);
        return;
      }

      // Atras desde formulario → portada, sin salir de la pagina.
      if (this.stateManager.is(AppState.REGISTRATION)) {
        this.#resetSessionToHome();
        this.stateManager.setState(AppState.LANDING);
      }
    });
  }

  #resetSessionToHome() {
    this.ui.clearRegistrationErrors();
    this.#participantUuid = null;
    this.#userData = null;
    this.#lastBlob = null;
    this.recorder.cancel();
    this.preview.clear();
    this.ui.updateLiveIndicators({});
  }

  /**
   * @param {{ phase: string, countdown: number|null, remainingSeconds: number|null }} payload
   */
  #onRecorderTick(payload) {
    this.ui.updateLiveIndicators({
      countdown: payload.countdown,
      remainingSeconds: payload.remainingSeconds,
      showRec: payload.phase === 'recording',
    });

    if (payload.phase === 'recording' && this.stateManager.is(AppState.COUNTDOWN)) {
      this.stateManager.setState(AppState.RECORDING);
    }
  }

  /**
   * Portada → formulario (tras animacion de salida).
   */
  async #handleStart() {
    if (!this.stateManager.is(AppState.LANDING) || this.#starting) {
      return;
    }

    this.#starting = true;

    try {
      await this.ui.playLandingExit();
      this.ui.clearRegistrationErrors();
      this.#participantUuid = null;
      this.#userData = null;
      history.pushState({ app: 'babysec', screen: 'registration' }, '');
      this.stateManager.setState(AppState.REGISTRATION);
    } finally {
      this.#starting = false;
    }
  }

  /**
   * Formulario → portada (boton "Volver al inicio").
   */
  #handleBackHome() {
    if (!this.stateManager.is(AppState.REGISTRATION)) {
      return;
    }

    this.#resetSessionToHome();

    if (history.state?.screen === 'registration') {
      history.back();
      return;
    }

    history.replaceState({ app: 'babysec', screen: 'landing' }, '');
    this.stateManager.setState(AppState.LANDING);
  }

  /**
   * Valida datos, registra en servidor y activa cámara.
   */
  async #handleRegistrationSubmit() {
    if (this.#registering) {
      return;
    }

    const input = this.ui.getRegistrationInput();
    const result = validateRegistration(input);

    if (!result.valid) {
      this.ui.showRegistrationErrors(result.errors);
      return;
    }

    this.ui.clearRegistrationErrors();
    this.#registering = true;
    this.ui.setContinueEnabled(false);

    try {
      // Si ya hay UUID (reintento tras error de cámara), no volver a registrar.
      if (!this.#participantUuid) {
        const registered = await this.uploader.register(result.data);
        this.#participantUuid = registered.uuid;
      }

      this.#userData = result.data;

      await this.camera.start({ refresh: true });
      this.renderer.setVideoSource(this.camera.getVideoElement());
      this.renderer.startLoop();
      this.stateManager.setState(AppState.CAMERA);
    } catch (error) {
      this.#handleError(
        error instanceof Error ? error.message : 'No se pudo completar el registro.',
      );
    } finally {
      this.#registering = false;
      this.ui.setContinueEnabled(true);
    }
  }

  #handleRecord() {
    if (!this.stateManager.is(AppState.CAMERA)) {
      return;
    }

    this.stateManager.setState(AppState.COUNTDOWN);
    this.recorder.start();
  }

  #handleStop() {
    if (!this.stateManager.is(AppState.RECORDING)) {
      return;
    }

    this.recorder.stop();
  }

  #handleRecordingComplete(blob) {
    this.#lastBlob = blob;
    this.#lastFilename = generateFilename();
    this.preview.show(blob);
    this.stateManager.setState(AppState.PREVIEW);
  }

  #handleRetry() {
    this.preview.clear();
    this.#lastBlob = null;
    this.recorder.cancel();
    this.ui.updateLiveIndicators({});
    this.stateManager.setState(AppState.CAMERA);
  }

  async #handleSend() {
    const blob = this.preview.getBlob();
    if (!blob || !this.#participantUuid) {
      this.#handleError('Falta el registro del participante. Volvé a completar tus datos.');
      return;
    }

    this.stateManager.setState(AppState.UPLOADING);
    this.ui.setUploadMessage('Subiendo video...');

    try {
      const result = await this.uploader.upload(blob, this.#participantUuid, this.#lastFilename);
      this.#uploadResult = result;
      this.ui.showFinished({ ...result, user: this.#userData ?? result.user });
      this.stateManager.setState(AppState.FINISHED);
    } catch (error) {
      this.#handleError(
        error instanceof Error ? error.message : 'Error al subir el video.',
      );
    }
  }

  /**
   * Descarga el video: primero el blob local, si no hay, desde el servidor.
   */
  async #handleDownload() {
    const blob = this.#lastBlob ?? this.preview.getBlob();

    if (blob) {
      downloadBlob(blob, this.#lastFilename);
      return;
    }

    const serverUrl = this.ui.getFinishedDownloadUrl();
    if (serverUrl) {
      try {
        await downloadFromUrl(serverUrl, this.#lastFilename);
      } catch (error) {
        this.#handleError(
          error instanceof Error ? error.message : 'No se pudo descargar el video.',
        );
      }
    }
  }

  /**
   * Publicar en redes vía Web Share API (Instagram, TikTok, WhatsApp, etc.).
   */
  async #handleShare() {
    const blob = this.#lastBlob ?? this.preview.getBlob();
    if (!blob) {
      return;
    }

    if (!canShareFiles()) {
      this.#handleError(
        'Tu navegador no permite publicar directamente. Descargá el video y subilo a tus redes.',
      );
      return;
    }

    try {
      const shared = await shareVideoToSocial(blob, this.#lastFilename, this.#userData ?? {});
      if (!shared) {
        this.#handleError(
          'No se pudo abrir el menú de compartir. Descargá el video e importalo manualmente.',
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        this.#handleError(error.message);
      }
    }
  }

  async #handleErrorRetry() {
    this.recorder.cancel();
    this.ui.updateLiveIndicators({});

    // Fallo de subida: reintentar envío sin perder el video ni el UUID.
    if (this.#lastBlob && this.#participantUuid) {
      this.preview.show(this.#lastBlob);
      this.stateManager.setState(AppState.PREVIEW);
      return;
    }

    this.preview.clear();
    this.#lastBlob = null;

    // Cámara ya activa: volver a la vista en vivo.
    if (this.camera.getStream() && this.#participantUuid) {
      this.renderer.startLoop();
      this.stateManager.setState(AppState.CAMERA);
      return;
    }

    // Ya registrado pero sin cámara: re-enumerar dispositivos y reintentar acceso.
    if (this.#participantUuid && this.#userData) {
      try {
        await this.camera.start({ refresh: true });
        this.renderer.setVideoSource(this.camera.getVideoElement());
        this.renderer.startLoop();
        this.stateManager.setState(AppState.CAMERA);
      } catch (error) {
        this.#handleError(
          error instanceof Error ? error.message : 'No se pudo acceder a la cámara.',
        );
      }
      return;
    }

    // Volver a la portada.
    this.stateManager.setState(AppState.LANDING);
  }

  #handleError(message) {
    this.ui.showErrorMessage(message);
    this.stateManager.setState(AppState.ERROR);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new BabysecSelfieApp();
  app.init().catch((error) => {
    console.error(error);
    alert(error instanceof Error ? error.message : 'Error al iniciar la aplicación.');
  });
});
