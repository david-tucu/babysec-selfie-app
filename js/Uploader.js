/**
 * Registro de participante y subida de video vía FormData + fetch.
 */

import { generateFilename } from './Utils.js';

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
   * @param {Blob} blob
   * @param {string} uuid
   * @param {string} [filename]
   * @returns {Promise<{ success: boolean, filename?: string, url?: string, downloadUrl?: string, message?: string }>}
   */
  async upload(blob, uuid, filename = generateFilename()) {
    const formData = new FormData();
    formData.append('uuid', uuid);
    formData.append('video', blob, filename);

    return this.#postForm(this.#uploadEndpoint, formData, 'No se pudo subir el video.');
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
