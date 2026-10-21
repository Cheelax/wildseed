// All sounds are synthesized locally, after a user gesture; no audio assets.
export class CreatureVoice {
  context = null;
  muted = false;
  last = 0;
  nodes = new Set();
  async cry(genome) {
    if (this.muted) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      this.context ??= new Ctx();
      await this.context.resume();
      const ctx = this.context, time = ctx.currentTime;
      if (time - this.last < 0.35 && this.last) return;
      this.last = time;
      const { note, shape, rhythm } = genome.traits.voice;
      const base = 440 * 2 ** ((note - 69) / 12);
      for (let i = 0; i < rhythm; i++) {
        const start = time + i * 0.115;
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = ['sine', 'triangle', 'sine'][shape];
        oscillator.frequency.setValueAtTime(base * (1 + i * 0.13), start);
        oscillator.frequency.exponentialRampToValueAtTime(base * (i % 2 ? 0.82 : 1.42), start + 0.12);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(start); oscillator.stop(start + 0.2);
        this.nodes.add(oscillator);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.nodes.delete(oscillator); };
      }
    } catch { /* Muted/unsupported audio never prevents a hatch. */ }
  }
  silence() {
    for (const oscillator of this.nodes) { try { oscillator.stop(); } catch {} }
    this.nodes.clear();
  }
}
