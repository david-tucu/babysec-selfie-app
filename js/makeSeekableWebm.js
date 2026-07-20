/**
 * Remux WebM de MediaRecorder a archivo seekable (Duration + Cues).
 * Usa ts-ebml (global EBML cargado desde js/vendor/EBML.js).
 *
 * Sin Cues, players nativos (p. ej. Samsung Video Player) suelen congelar
 * tras los primeros frames y saltar al final; Photos es mas tolerante.
 *
 * Chrome a veces emite mas de un Segment; el Reader de ts-ebml entonces
 * calcula Duration corta (~1s). Por eso se puede forzar durationMs del timer.
 */

/**
 * @returns {typeof globalThis.EBML | null}
 */
function getEbml() {
  const ebml = globalThis.EBML;
  if (
    ebml
    && typeof ebml.Decoder === 'function'
    && typeof ebml.Reader === 'function'
    && ebml.tools
    && typeof ebml.tools.makeMetadataSeekable === 'function'
  ) {
    return ebml;
  }
  return null;
}

/**
 * Duration en unidades TimecodeScale (ms si TimecodeScale = 1_000_000).
 * @param {number} readerDuration
 * @param {number|null|undefined} durationMs
 * @param {number} timecodeScale
 * @returns {number}
 */
function resolveDuration(readerDuration, durationMs, timecodeScale) {
  const scale = Number.isFinite(timecodeScale) && timecodeScale > 0
    ? timecodeScale
    : 1_000_000;

  // elapsed wall-clock ? unidades del archivo (ns / TimecodeScale).
  const fromApp = Number.isFinite(durationMs) && durationMs > 0
    ? (durationMs * 1_000_000) / scale
    : null;

  const fromReader = Number.isFinite(readerDuration) && readerDuration > 0
    ? readerDuration
    : null;

  if (fromApp != null && fromReader != null) {
    // Si EBML quedo corto (multi-segment / cues truncados), priorizar el timer.
    if (fromReader < fromApp * 0.75) {
      return fromApp;
    }
    return Math.max(fromReader, fromApp);
  }

  return fromApp ?? fromReader ?? 0;
}

/**
 * @param {Blob} blob
 * @param {{ durationMs?: number|null }} [options]
 * @returns {Promise<Blob>}
 */
export async function makeSeekableWebm(blob, options = {}) {
  const EBML = getEbml();
  if (!EBML) {
    throw new Error('EBML (ts-ebml) no esta cargado.');
  }

  const durationMs = options.durationMs;
  const buffer = await blob.arrayBuffer();
  const decoder = new EBML.Decoder();
  const reader = new EBML.Reader();
  reader.logging = false;

  const elms = decoder.decode(buffer);
  let segmentOpens = 0;

  for (const elm of elms) {
    // Evitar que un 2º Segment pise offsets/cues y deje Duration en ~1s.
    if (elm.type === 'm' && elm.name === 'Segment' && !elm.isEnd) {
      segmentOpens += 1;
      if (segmentOpens > 1) {
        console.warn('[babysec][video-diag] ignoring extra WebM Segment for seekable remux');
        break;
      }
    }
    reader.read(elm);
  }
  reader.stop();

  const duration = resolveDuration(
    reader.duration,
    durationMs,
    reader.timecodeScale,
  );

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('No se pudo obtener duracion EBML del WebM.');
  }

  console.log('[babysec][video-diag] seekable duration', {
    readerDuration: reader.duration,
    durationMs,
    timecodeScale: reader.timecodeScale,
    writtenDuration: duration,
    segmentOpens,
    cueCount: Array.isArray(reader.cues) ? reader.cues.length : 0,
  });

  const refinedMetadataBuf = EBML.tools.makeMetadataSeekable(
    reader.metadatas,
    duration,
    reader.cues,
  );
  const body = buffer.slice(reader.metadataSize);
  const mime = blob.type && blob.type.startsWith('video/')
    ? blob.type.split(';')[0]
    : 'video/webm';

  return new Blob([refinedMetadataBuf, body], { type: mime });
}

/**
 * @returns {boolean}
 */
export function canMakeSeekableWebm() {
  return getEbml() !== null;
}
