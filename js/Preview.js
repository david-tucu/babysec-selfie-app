/**
 * Gestión de la previsualización del video grabado.
 * No manipula el DOM directamente; delega en callbacks.
 */

export class Preview {
  /** @type {Blob|null} */
  #blob = null;

  /** @type {string|null} */
  #objectUrl = null;

  /**
   * @param {{
   *   onReady?: (objectUrl: string, blob: Blob) => void,
   *   onCleared?: () => void,
   * }} [options]
   */
  constructor(options = {}) {
    this.#onReady = options.onReady ?? (() => {});
    this.#onCleared = options.onCleared ?? (() => {});
  }

  /** @type {(objectUrl: string, blob: Blob) => void} */
  #onReady;

  /** @type {() => void} */
  #onCleared;

  /**
   * Recibe el Blob grabado y prepara URL reproducible.
   * @param {Blob} blob
   */
  show(blob) {
    this.clear();

    this.#blob = blob;
    this.#objectUrl = URL.createObjectURL(blob);
    this.#onReady(this.#objectUrl, blob);
  }

  /**
   * Libera recursos de la preview actual.
   */
  clear() {
    if (this.#objectUrl) {
      URL.revokeObjectURL(this.#objectUrl);
      this.#objectUrl = null;
    }

    this.#blob = null;
    this.#onCleared();
  }

  /**
   * Blob del video actual.
   * @returns {Blob|null}
   */
  getBlob() {
    return this.#blob;
  }

  /**
   * URL de objeto para reproducir el video.
   * @returns {string|null}
   */
  getObjectUrl() {
    return this.#objectUrl;
  }
}
