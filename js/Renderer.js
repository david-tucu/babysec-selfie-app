/**
 * Renderizado en canvas 1080×1920 (9:16).
 * Capas: video (cover en la zona del marco, espejo) → marco.
 * El logo ya viene incluido en marco.png.
 * El canvas es la fuente de grabación; countdown/REC van solo en el DOM (UI).
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  computeCoverRect,
  getFrameViewportRect,
} from './Utils.js';

export class Renderer {
  /** @type {HTMLCanvasElement} */
  #canvas;

  /** @type {CanvasRenderingContext2D} */
  #ctx;

  /** @type {HTMLVideoElement|null} */
  #video = null;

  /** @type {HTMLImageElement|null} */
  #frameImage = null;

  /** @type {number|null} */
  #animationId = null;

  /** @type {boolean} */
  #mirror;

  /**
   * @param {{ frameSrc?: string, mirror?: boolean }} [options]
   */
  constructor(options = {}) {
    this.#canvas = document.createElement('canvas');
    this.#canvas.width = CANVAS_WIDTH;
    this.#canvas.height = CANVAS_HEIGHT;

    const ctx = this.#canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D no disponible.');
    }
    this.#ctx = ctx;

    this.#frameSrc = options.frameSrc ?? 'assets/marco.png';
    this.#mirror = options.mirror ?? true;
  }

  /** @type {string} */
  #frameSrc;

  /**
   * Canvas interno usado como fuente de grabación y preview.
   * @returns {HTMLCanvasElement}
   */
  getCanvas() {
    return this.#canvas;
  }

  /**
   * Activa o desactiva el modo espejo (horizontal flip).
   * @param {boolean} enabled
   */
  setMirror(enabled) {
    this.#mirror = enabled;
  }

  /**
   * Carga la imagen del marco.
   */
  async loadAssets() {
    this.#frameImage = await this.#loadImage(this.#frameSrc);
  }

  /**
   * @param {string} src
   * @returns {Promise<HTMLImageElement>}
   */
  #loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
      img.src = src;
    });
  }

  /**
   * Asigna el elemento video de la cámara como fuente.
   * @param {HTMLVideoElement} videoElement
   */
  setVideoSource(videoElement) {
    this.#video = videoElement;
  }

  /**
   * Inicia el loop de renderizado continuo.
   */
  startLoop() {
    if (this.#animationId !== null) {
      return;
    }

    const tick = () => {
      this.drawFrame();
      this.#animationId = requestAnimationFrame(tick);
    };

    tick();
  }

  /**
   * Detiene el loop de renderizado.
   */
  stopLoop() {
    if (this.#animationId !== null) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }
  }

  /**
   * Dibuja un frame completo en el canvas.
   */
  drawFrame() {
    const { width, height } = this.#canvas;

    this.#ctx.fillStyle = '#000';
    this.#ctx.fillRect(0, 0, width, height);

    // Capa 1 + 2: Video cover solo en la zona visible del marco (menos zoom)
    if (this.#video && this.#video.readyState >= 2) {
      const viewport = getFrameViewportRect();
      const cover = computeCoverRect(
        this.#video.videoWidth,
        this.#video.videoHeight,
        viewport.width,
        viewport.height,
      );

      const destX = viewport.x + cover.dx;
      const destY = viewport.y + cover.dy;

      this.#ctx.save();
      this.#ctx.beginPath();
      this.#ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
      this.#ctx.clip();

      if (this.#mirror) {
        const centerX = viewport.x + viewport.width / 2;
        this.#ctx.translate(centerX, 0);
        this.#ctx.scale(-1, 1);
        this.#ctx.translate(-centerX, 0);
      }

      this.#ctx.drawImage(
        this.#video,
        cover.sx,
        cover.sy,
        cover.sw,
        cover.sh,
        destX,
        destY,
        cover.dw,
        cover.dh,
      );

      this.#ctx.restore();
    }

    // Capa 3: Marco PNG (incluye logo)
    if (this.#frameImage) {
      this.#ctx.drawImage(this.#frameImage, 0, 0, width, height);
    }
  }
}
