/**
 * Máquina de estados centralizada.
 * Toda la lógica de la app depende del estado actual, no de flags booleanos.
 */

/** Estados posibles de la aplicación. */
export const AppState = {
  LANDING: 'LANDING',
  REGISTRATION: 'REGISTRATION',
  CAMERA: 'CAMERA',
  COUNTDOWN: 'COUNTDOWN',
  RECORDING: 'RECORDING',
  PREVIEW: 'PREVIEW',
  UPLOADING: 'UPLOADING',
  FINISHED: 'FINISHED',
  ERROR: 'ERROR',
};

export class StateManager {
  /** @type {string} */
  #state = AppState.LANDING;

  /** @type {Set<(state: string, prevState: string) => void>} */
  #listeners = new Set();

  /**
   * @returns {string} Estado actual
   */
  getState() {
    return this.#state;
  }

  /**
   * Comprueba si el estado actual coincide con el indicado.
   * @param {string} state
   * @returns {boolean}
   */
  is(state) {
    return this.#state === state;
  }

  /**
   * Comprueba si el estado actual está en la lista dada.
   * @param {string[]} states
   * @returns {boolean}
   */
  isOneOf(states) {
    return states.includes(this.#state);
  }

  /**
   * Cambia el estado y notifica a los suscriptores.
   * @param {string} nextState
   */
  setState(nextState) {
    if (!Object.values(AppState).includes(nextState)) {
      throw new Error(`Estado inválido: ${nextState}`);
    }

    if (this.#state === nextState) {
      return;
    }

    const prevState = this.#state;
    this.#state = nextState;
    this.#listeners.forEach((listener) => listener(nextState, prevState));
  }

  /**
   * Suscribe un callback a cambios de estado.
   * @param {(state: string, prevState: string) => void} listener
   * @returns {() => void} Función para cancelar la suscripción
   */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
