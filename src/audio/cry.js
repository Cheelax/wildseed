// The cry: a few notes sung through two vowel formants, all from the genome. The pitch comes from the
// voice gene and the body's size, the timbre from the affinity (soft moss, gruff stone, buzzy spark),
// the melody from the contour, the vowel from the vowel gene. Rare creatures add a chime.

const VOWELS = { a: [800, 1200], e: [480, 1900], i: [320, 2400], o: [520, 880], u: [360, 720] };
const TIMBRE = {
  moss: { wave: "triangle", grit: 0, bright: 2600 },
  stone: { wave: "square", grit: 0.25, bright: 1500 },
  spark: { wave: "sawtooth", grit: 0, bright: 4200 },
};

let ctx = null;

/** Browsers start sound only after a gesture: call this from one (a click, a key). */
export function wakeAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  ctx ??= new Audio();
  if (ctx.state === "suspended") ctx.resume();
}

/** Plays the creature's cry. Does nothing until the page has had a gesture. */
export function cry(genome) {
  if (!ctx || ctx.state !== "running") return;
  const { pitch, notes, contour, vowel } = genome.traits.voice;
  const timbre = TIMBRE[genome.affinity];
  const [f1, f2] = VOWELS[vowel];
  const start = ctx.currentTime + 0.02;
  const out = ctx.createGain();
  out.gain.value = 0.28;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = timbre.bright;
  lowpass.connect(out);
  out.connect(ctx.destination);

  const length = notes === 1 ? 0.3 : 0.17;
  for (let k = 0; k < notes; k++) {
    const t0 = start + k * (length + 0.05);
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
      f.exponentialRampToValueAtTime(base * 0.75, t1);
    } else {
      f.setValueAtTime(base * 0.9, t0);
      f.exponentialRampToValueAtTime(base * 1.15, t0 + length * 0.35);
      f.exponentialRampToValueAtTime(base, t1);
    }
    const vibrato = ctx.createOscillator();
    const depth = ctx.createGain();
    vibrato.frequency.value = contour === "trill" ? 22 : 7;
    depth.gain.value = base * (contour === "trill" ? 0.09 : 0.025);
    vibrato.connect(depth).connect(f);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(1, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.5, t0 + length * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    for (const [freq, q, gain] of [[f1, 5, 1], [f2, 8, 0.6]]) {
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = freq;
      band.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain * 2.2;
      osc.connect(band).connect(g).connect(env);
    }
    const dry = ctx.createGain();
    dry.gain.value = 0.35;
    osc.connect(dry).connect(env);
    env.connect(lowpass);
    osc.start(t0);
    vibrato.start(t0);
    osc.stop(t1 + 0.05);
    vibrato.stop(t1 + 0.05);
  }

  if (timbre.grit) {
    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const g = ctx.createGain();
    g.gain.value = timbre.grit;
    src.connect(g).connect(lowpass);
    src.start(start);
  }

  if (genome.rare) {
    const chime = ctx.createOscillator();
    chime.type = "sine";
    chime.frequency.value = pitch * 4;
    const g = ctx.createGain();
    const t = start + notes * (length + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    chime.connect(g).connect(out);
    chime.start(t);
    chime.stop(t + 0.65);
  }
}
