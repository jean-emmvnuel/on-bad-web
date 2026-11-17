// Notes vocales : enregistrement par le micro du navigateur (MediaRecorder) et lecture une à la fois.
// Format : WebM/Opus (Chrome, Android, Firefox) ou MP4/AAC (Safari, iPhone), 64 kbit/s.
//
// Son bien audible : le micro passe par une petite chaîne de traitement avant l'enregistrement
//   contrôle automatique du gain du navigateur → compresseur (voix régulière) → gain de rattrapage → limiteur (pas de saturation).
// Onde représentative : calculée après coup sur le son réellement enregistré (décodé), barre par barre,
//   en décibels (comme l'oreille) ; si le décodage échoue, on garde les niveaux mesurés pendant l'enregistrement.

export const MIN_VOICE_MS = 800;
const BARS = 48;
const SAMPLE_MS = 50;
const BITRATE = 64_000;
const TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
// Échelle de l'onde : en dessous de FLOOR_DB, c'est du silence (barre minimale) ; CEIL_DB = barre pleine.
const FLOOR_DB = -50;
const CEIL_DB = -6;
const MIN_BAR = 6;

/** Le navigateur sait-il enregistrer du son ? */
export function canRecordVoice() {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder === 'function';
}

const pickType = () => TYPES.find((t) => window.MediaRecorder.isTypeSupported?.(t)) ?? '';
const AudioCtx = () => window.AudioContext || window.webkitAudioContext;

/** Niveau RMS (0 à 1) → hauteur de barre (MIN_BAR à 100), sur une échelle en décibels. */
function barHeight(rms) {
  const db = 20 * Math.log10(Math.max(rms, 1e-6));
  const t = (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB);
  return Math.round(MIN_BAR + Math.min(1, Math.max(0, t)) * (100 - MIN_BAR));
}

/** Onde à partir des échantillons réels : RMS de chaque tranche, en dB. */
function barsFromSamples(samples) {
  const out = [];
  const size = samples.length / BARS;
  for (let i = 0; i < BARS; i += 1) {
    const from = Math.floor(i * size);
    const to = Math.max(from + 1, Math.floor((i + 1) * size));
    let sum = 0;
    for (let j = from; j < to; j += 1) sum += samples[j] * samples[j];
    out.push(barHeight(Math.sqrt(sum / (to - from))));
  }
  return out;
}

/** Onde de secours : niveaux RMS mesurés pendant l'enregistrement, regroupés en BARS barres. */
function barsFromLevels(levels) {
  if (!levels.length) return Array(BARS).fill(MIN_BAR);
  return Array.from({ length: BARS }, (_, i) => {
    const from = Math.floor((i * levels.length) / BARS);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / BARS));
    const slice = levels.slice(from, to);
    return barHeight(Math.sqrt(slice.reduce((a, v) => a + v * v, 0) / slice.length));
  });
}

/** Décode le son enregistré et en tire l'onde (null si le navigateur ne sait pas le décoder). */
async function waveformOf(blob) {
  const Ctx = AudioCtx();
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    return barsFromSamples(decoded.getChannelData(0));
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => {});
  }
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('read'));
  r.readAsDataURL(blob);
});

/**
 * Chaîne de traitement de la voix : renvoie le flux à enregistrer et un analyseur pour le niveau en direct.
 * Sans Web Audio (très vieux navigateur) : le flux du micro tel quel.
 */
function processVoice(stream) {
  const Ctx = AudioCtx();
  if (!Ctx) return { output: stream, analyser: null, ctx: null };
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  // Coupe les basses inutiles (souffle, vibrations du téléphone) qui mangent le volume sans rien apporter.
  const highpass = Object.assign(ctx.createBiquadFilter(), { type: 'highpass' });
  highpass.frequency.value = 85;
  // Compresseur : rapproche les passages faibles et forts, la voix reste intelligible même chuchotée.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -30;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  // Gain de rattrapage (+9 dB environ) puis limiteur : plus fort, sans saturer.
  const makeup = ctx.createGain();
  makeup.gain.value = 2.8;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const dest = ctx.createMediaStreamDestination();
  source.connect(highpass).connect(comp).connect(makeup).connect(limiter);
  limiter.connect(dest);
  limiter.connect(analyser);
  return { output: dest.stream, analyser, ctx };
}

/**
 * Démarre un enregistrement (demande l'accès au micro la première fois).
 * `maxMs` : durée maximale (réglée par l'équipe) ; `onTick(ms, level)` : durée écoulée et niveau (0 à 1) ; `onLimit()` à la limite.
 * Renvoie { stop(): Promise<{ dataUrl, durationMs, waveform } | null>, cancel() }.
 * Lève une erreur `mic_denied` / `mic_unavailable` si le micro est refusé ou absent.
 */
export async function startVoice({ maxMs = 60_000, onTick, onLimit } = {}) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch (error) {
    const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
    throw Object.assign(new Error(denied ? 'mic_denied' : 'mic_unavailable'), { code: denied ? 'mic_denied' : 'mic_unavailable' });
  }

  const { output, analyser, ctx } = processVoice(stream);
  if (ctx?.state === 'suspended') await ctx.resume().catch(() => {});
  const type = pickType();
  const recorder = new MediaRecorder(output, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: BITRATE });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

  const buf = analyser ? new Float32Array(analyser.fftSize) : null;
  const levels = [];
  const started = performance.now();
  let finished = false;

  const timer = setInterval(() => {
    let rms = 0;
    if (analyser) {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      rms = Math.sqrt(sum / buf.length);
    }
    levels.push(rms);
    const ms = performance.now() - started;
    onTick?.(ms, (barHeight(rms) - MIN_BAR) / (100 - MIN_BAR));
    if (ms >= maxMs) onLimit?.();
  }, SAMPLE_MS);

  const release = () => {
    finished = true;
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
  };

  recorder.start(250);

  return {
    stop: () => new Promise((resolve) => {
      if (finished) return resolve(null);
      const durationMs = Math.min(maxMs, Math.round(performance.now() - started));
      recorder.onstop = async () => {
        release();
        if (durationMs < MIN_VOICE_MS || !chunks.length) return resolve(null);
        // Type simple (« audio/mp4 ») : Safari annonce « audio/mp4; codecs=… » voire « video/mp4 » pour un enregistrement audio.
        const clean = (recorder.mimeType || type || 'audio/webm').split(';')[0].trim().replace(/^video\//, 'audio/');
        const blob = new Blob(chunks, { type: clean });
        try {
          const waveform = (await waveformOf(blob)) ?? barsFromLevels(levels);
          resolve({ dataUrl: await blobToDataUrl(blob), durationMs, waveform });
        } catch {
          resolve(null);
        }
      };
      recorder.stop();
    }),
    cancel: () => {
      if (finished) return;
      recorder.onstop = release;
      try { recorder.stop(); } catch { release(); }
    },
  };
}

// ─── Lecture : un seul vocal à la fois ─────────────────────

let playing = null;

/** À appeler quand un lecteur démarre : met en pause celui qui jouait. */
export function claimPlayback(audio) {
  if (playing && playing !== audio) playing.pause();
  playing = audio;
}

/** « 0:07 », « 1:00 ». */
export const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
