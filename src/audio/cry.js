// The cry: a few notes sung through two vowel formants, all from the genome. The pitch comes from the
// voice gene and the body's size, the timbre from the affinity (a soft moss coo, a gruff stone rumble, a
// buzzy spark chirp), the melody from the contour, the vowel from the vowel gene. Rare creatures add a chime.

const VOWELS = { a: [800, 1200], e: [480, 1900], i: [320, 2400], o: [520, 880], u: [360, 720] };
const TIMBRE = {
  moss: { wave: "sine", fm: 1.6, growl: 0, bright: 2600 },
  stone: { wave: "triangle", fm: 0.8, growl: 0.5, bright: 1600 },
  spark: { wave: "square", fm: 0.4, growl: 0, bright: 3800 },
};

let live = null;
let muted = false;

/** Turns every sound off or back on. */
export function mute(off) {
  muted = off;
}

/** Browsers start sound only after a gesture: call this from one (a click, a key). */
export function wakeAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  live ??= new Audio();
  if (live.state === "suspended") live.resume();
}

/** The egg's sounds, from now: a crack at each of `cracks` seconds, a pop as the cap comes off at `open`, a crumble at `burst`. */
export function hatchSounds({ cracks, open, burst }, delay = 0) {
  if (muted || live?.state !== "running") return;
  const now = live.currentTime + 0.02 + delay;
  cracks.forEach((t, i) => noise(live, now + t, 0.035, 1800 + 500 * i, 0.5));
  noise(live, now + open, 0.1, 1100, 0.8);
  noise(live, now + burst, 0.16, 650, 0.9);
}

/** A short burst of filtered noise: a crack (short, high) or a pop (longer, lower). */
function noise(ctx, at, length, freq, gain) {
  const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(band).connect(g).connect(ctx.destination);
  src.start(at);
}

/** Plays the creature's cry now. Does nothing until the page has had a gesture. */
export function cry(genome) {
  if (!muted && live?.state === "running") sing(live, genome, live.currentTime + 0.02);
}

/**
 * Schedules the cry of `genome` on an audio context (the page's, or an offline one) from `start`.
 * Returns its length in seconds.
 */
export function sing(ctx, genome, start = 0) {
  const { pitch, notes, contour, vowel } = genome.traits.voice;
  const timbre = TIMBRE[genome.affinity];
  const [f1, f2] = VOWELS[vowel];

  // Everything goes through a gentle limiter, so a cry is never harsh, whatever its genes.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  const out = ctx.createGain();
  out.gain.value = 0.5;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = timbre.bright;
  lowpass.connect(out).connect(limiter).connect(ctx.destination);

  const length = notes === 1 ? 0.32 : 0.17;
  const gap = 0.05;
  for (let k = 0; k < notes; k++) {
    const t0 = start + k * (length + gap);
    const t1 = t0 + length;
    const base = pitch * (contour === "hop" ? [1, 1.35, 1.15][k] : contour === "fall" ? 1 - 0.08 * k : 1 + 0.06 * k);
    const osc = ctx.createOscillator();
    osc.type = timbre.wave;
    const f = osc.frequency;
    if (contour === "rise") {
      f.setValueAtTime(base * 0.8, t0);
      f.exponentialRampToValueAtTime(base * 1.4, t1);
    } else if (contour === "fall") {
      f.setValueAtTime(base * 1.4, t0);
      f.exponentialRampToValueAtTime(base * 0.78, t1);
    } else {
      f.setValueAtTime(base * 0.9, t0);
      f.exponentialRampToValueAtTime(base * 1.15, t0 + length * 0.35);
      f.exponentialRampToValueAtTime(base, t1);
    }
    // A second oscillator bends the first (FM): warmth for moss, a little edge for spark.
    const mod = ctx.createOscillator();
    const index = ctx.createGain();
    mod.frequency.value = base * 2;
    index.gain.value = base * timbre.fm;
    mod.connect(index).connect(f);
    // Vibrato, fast and wide for a trill.
    const vib = ctx.createOscillator();
    const depth = ctx.createGain();
    vib.frequency.value = contour === "trill" ? 22 : 6.5;
    depth.gain.value = base * (contour === "trill" ? 0.08 : 0.02);
    vib.connect(depth).connect(f);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(1, t0 + 0.018);
    env.gain.exponentialRampToValueAtTime(0.55, t0 + length * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    // A stone voice rumbles: its loudness shakes thirty times a second.
    let voice = env;
    if (timbre.growl) {
      const shake = ctx.createGain();
      const lfo = ctx.createOscillator();
      const amount = ctx.createGain();
      shake.gain.value = 1 - timbre.growl / 2;
      lfo.frequency.value = 30;
      amount.gain.value = timbre.growl / 2;
      lfo.connect(amount).connect(shake.gain);
      env.connect(shake);
      voice = shake;
      lfo.start(t0);
      lfo.stop(t1 + 0.05);
    }
    for (const [freq, q, gain] of [[f1, 4, 1.4], [f2, 7, 0.9]]) {
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = freq;
      band.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(band).connect(g).connect(env);
    }
    const dry = ctx.createGain();
    dry.gain.value = 0.3;
    osc.connect(dry).connect(env);
    voice.connect(lowpass);
    for (const o of [osc, mod, vib]) {
      o.start(t0);
      o.stop(t1 + 0.05);
    }
  }
  let end = start + notes * (length + gap);

  if (genome.rare) {
    const chime = ctx.createOscillator();
    chime.type = "sine";
    chime.frequency.value = pitch * 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, end);
    g.gain.exponentialRampToValueAtTime(0.4, end + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.6);
    chime.connect(g).connect(out);
    chime.start(end);
    chime.stop(end + 0.65);
    end += 0.6;
  }
  return end - start;
}
