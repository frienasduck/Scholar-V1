import type { Ambience } from "../music-store";
type Layer = { source: AudioBufferSourceNode; gain: GainNode; modulator?: OscillatorNode };
/** Scholar-synthesized noise textures. No YouTube audio is inspected or copied. */
export class AmbienceEngine {
  private context: AudioContext | null = null;
  private layers = new Map<Ambience, Layer>();
  async resume() {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }
  update(levels: Record<Ambience, number>, enabled: boolean) {
    const ctx = this.context; if (!ctx) return;
    for (const key of Object.keys(levels) as Ambience[]) {
      let layer = this.layers.get(key);
      if (!layer && enabled && levels[key] > 0) {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; brown = (brown + white * 0.02) / 1.02; data[i] = key === "brown" || key === "ocean" ? brown * 3.5 : white; }
        const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
        source.buffer = buffer; source.loop = true; gain.gain.value = 0;
        filter.type = "lowpass"; filter.frequency.value = key === "rain" ? 2800 : key === "white" ? 8000 : 650;
        source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start();
        layer = { source, gain };
        this.layers.set(key, layer);
      }
      if (layer) {
        if (key === "ocean" && enabled && levels[key] > 0 && !layer.modulator) { const modulator = ctx.createOscillator(), modulation = ctx.createGain(); modulator.frequency.value = 0.12; modulation.gain.value = 0.02; modulator.connect(modulation); modulation.connect(layer.gain.gain); modulator.start(); layer.modulator = modulator; }
        layer.gain.gain.cancelScheduledValues(ctx.currentTime);
        layer.gain.gain.setTargetAtTime(enabled ? levels[key] / 100 * 0.09 : 0, ctx.currentTime, 0.2);
        // Stop modulation too: zero volume must actually be silent.
        if ((!enabled || !levels[key]) && layer.modulator) { layer.modulator.stop(); layer.modulator.disconnect(); layer.modulator = undefined; }
      }
    }
  }
  async destroy() { for (const layer of this.layers.values()) { layer.source.stop(); layer.modulator?.stop(); layer.gain.disconnect(); } this.layers.clear(); const ctx = this.context; this.context = null; if (ctx && ctx.state !== "closed") await ctx.close(); }
}
export const ambienceEngine = new AmbienceEngine();
