import type { MusicTrack, NativeTexture } from "./model";

export const NATIVE_AUDIO_CATALOG: MusicTrack[] = ([
  ["rain", "Rain texture"], ["brown", "Brown noise"], ["white", "White noise"], ["ocean", "Ocean texture"],
] as const).map(([texture, title]): MusicTrack => ({
  id: `audio:${texture}` as const, title, artist: "Scholar · synthesized audio", category: "Sound textures", thumbnail: "",
  mediaSource: "AUDIO_SOURCE", texture, provenance: "scholar-synthesized" as const, source: "native", durationSeconds: 16,
  tags: ["no lyrics", "calm", "ambient"],
}));

// Original procedural sound, never downloaded or extracted from YouTube.
// A bounded mono PCM loop is played by the browser's native audio element.
export function createTextureWav(texture: NativeTexture): ArrayBuffer {
  const rate = 22050, samples = rate * 16;
  const buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
  const word = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  word(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); word(8, "WAVE"); word(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, "data"); view.setUint32(40, samples * 2, true);
  let brown = 0, previous = 0;
  for (let i = 0; i < samples; i++) {
    const noise = Math.random() * 2 - 1;
    brown = (brown + .02 * noise) / 1.02;
    const sample = texture === "white" ? noise * .2 : texture === "rain" ? (noise - previous) * .18 : brown * 2.8;
    previous = noise;
    const tide = texture === "ocean" ? .5 + .3 * Math.sin(i / samples * Math.PI * 2) : 1;
    const fade = Math.min(1, i / 512, (samples - 1 - i) / 512);
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, sample * tide * fade)) * 32767), true);
  }
  return buffer;
}
