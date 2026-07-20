/**
 * Gestión del stream de cámara y micrófono.
 * No manipula el DOM; solo expone el MediaStream.
 */

export class Camera {
  /** @type {MediaStream|null} */
  #stream = null;

  /** @type {HTMLVideoElement} */
  #videoElement;

  /** @type {MediaTrackConstraints} */
  #videoIdeal;

  /**
   * @param {{ width?: number, height?: number }} [options]
   */
  constructor(options = {}) {
    this.#videoElement = document.createElement('video');
    this.#videoElement.setAttribute('playsinline', '');
    this.#videoElement.setAttribute('autoplay', '');
    this.#videoElement.muted = true;

    // Ideal cercano a la zona visible del marco (860×1340)
    this.#videoIdeal = {
      facingMode: { ideal: 'user' },
      width: { ideal: options.width ?? 860 },
      height: { ideal: options.height ?? 1340 },
      aspectRatio: { ideal: 860 / 1340 },
    };
  }

  /**
   * Elemento video oculto usado como fuente para el Renderer.
   * @returns {HTMLVideoElement}
   */
  getVideoElement() {
    return this.#videoElement;
  }

  /**
   * Stream activo de cámara/micrófono.
   * @returns {MediaStream|null}
   */
  getStream() {
    return this.#stream;
  }

  /**
   * Pista de audio del micrófono (para combinar con canvas en Recorder).
   * @returns {MediaStreamTrack|null}
   */
  getAudioTrack() {
    return this.#stream?.getAudioTracks()[0] ?? null;
  }

  /**
   * Solicita permisos e inicia cámara.
   * @param {{ refresh?: boolean }} [options] refresh=true re-enumera dispositivos y reintenta getUserMedia
   * @returns {Promise<MediaStream>}
   */
  async start(options = {}) {
    const refresh = Boolean(options.refresh);

    if (this.#stream && !refresh) {
      return this.#stream;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Tu navegador no soporta acceso a la cámara.');
    }

    // Liberar stream previo y forzar relectura de dispositivos.
    this.stop();
    const availability = await this.#probeDevices();
    const attempts = this.#buildConstraintAttempts(availability);

    /** @type {unknown} */
    let lastError = null;

    for (const constraints of attempts) {
      try {
        this.#stream = await navigator.mediaDevices.getUserMedia(constraints);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        this.#stream = null;
      }
    }

    if (!this.#stream) {
      throw new Error(this.#translateMediaError(lastError));
    }

    this.#videoElement.srcObject = this.#stream;

    try {
      await new Promise((resolve, reject) => {
        this.#videoElement.onloadedmetadata = () => {
          this.#videoElement.play().then(resolve).catch(reject);
        };
        this.#videoElement.onerror = () => reject(new Error('Error al reproducir el video de cámara.'));
      });
    } catch (error) {
      this.stop();
      throw new Error(
        error instanceof Error ? error.message : 'Error al reproducir el video de cámara.',
      );
    }

    return this.#stream;
  }

  /**
   * Re-enumera dispositivos disponibles (actualiza tras conectar cámara/mic).
   * @returns {Promise<{ video: boolean, audio: boolean, unknown: boolean }>}
   */
  async #probeDevices() {
    try {
      if (typeof navigator.mediaDevices.enumerateDevices !== 'function') {
        return { video: true, audio: true, unknown: true };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const video = devices.some((device) => device.kind === 'videoinput');
      const audio = devices.some((device) => device.kind === 'audioinput');

      // Sin permisos previos algunos navegadores devuelven lista vacía.
      if (devices.length === 0) {
        return { video: true, audio: true, unknown: true };
      }

      return { video, audio, unknown: false };
    } catch {
      return { video: true, audio: true, unknown: true };
    }
  }

  /**
   * Arma intentos de constraints, del más específico al más permisivo.
   * @param {{ video: boolean, audio: boolean, unknown: boolean }} availability
   * @returns {MediaStreamConstraints[]}
   */
  #buildConstraintAttempts(availability) {
    /** @type {MediaStreamConstraints[]} */
    const attempts = [];
    const tryAudio = availability.unknown || availability.audio;

    if (availability.unknown || availability.video) {
      if (tryAudio) {
        attempts.push({ audio: true, video: { ...this.#videoIdeal } });
        attempts.push({ audio: true, video: true });
      }

      // Desktop sin micrófono (o mic no disponible): continuar solo con video.
      attempts.push({ audio: false, video: { ...this.#videoIdeal } });
      attempts.push({ audio: false, video: true });
    }

    // Último recurso genérico.
    attempts.push({ audio: tryAudio, video: true });
    attempts.push({ audio: false, video: true });

    return attempts;
  }

  /**
   * Traduce errores de getUserMedia a mensajes en español.
   * @param {unknown} error
   * @returns {string}
   */
  #translateMediaError(error) {
    const name = error instanceof DOMException || error instanceof Error
      ? error.name
      : '';
    const message = error instanceof Error ? error.message : String(error ?? '');
    const normalized = message.toLowerCase();

    if (
      name === 'NotFoundError' ||
      name === 'DevicesNotFoundError' ||
      normalized.includes('requested device not found')
    ) {
      return 'No se encontró la cámara o el micrófono. Revisá que estén conectados y habilitados.';
    }

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'No se pudo acceder a la cámara. Permití el acceso en tu navegador e intentá de nuevo.';
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'La cámara está en uso por otra aplicación. Cerrala e intentá de nuevo.';
    }

    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return 'Tu cámara no cumple los requisitos necesarios. Probá con otro dispositivo.';
    }

    if (name === 'SecurityError') {
      return 'El acceso a la cámara está bloqueado por seguridad. Usá HTTPS o localhost.';
    }

    if (name === 'AbortError') {
      return 'Se interrumpió el acceso a la cámara. Intentá de nuevo.';
    }

    return 'No se pudo acceder a la cámara. Intentá de nuevo.';
  }

  /**
   * Detiene todas las pistas y libera recursos.
   */
  stop() {
    if (this.#stream) {
      this.#stream.getTracks().forEach((track) => track.stop());
      this.#stream = null;
    }

    this.#videoElement.srcObject = null;
  }
}
