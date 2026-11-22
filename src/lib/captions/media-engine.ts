/**
 * Browser media helpers built on Mediabunny (WebCodecs): probing, decoding the
 * voice track to 16 kHz mono for transcription, filmstrip thumbnails, and
 * audio extraction. Everything runs locally — the video never leaves the device
 * except as compact audio chunks sent for transcription.
 */

export type MediaInfo = {
  duration: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
  frameRate: number | null;
};

export const SPEECH_RATE = 16000;

type MB = typeof import("mediabunny");
let mbPromise: Promise<MB> | null = null;
export function loadMediabunny(): Promise<MB> {
  if (!mbPromise) mbPromise = import("mediabunny");
  return mbPromise;
}

let aacRegistered: Promise<void> | null = null;
/** Makes AAC encoding available everywhere (WASM fallback when the browser lacks it). */
export function ensureAac(): Promise<void> {
  if (!aacRegistered) {
    aacRegistered = (async () => {
      const mb = await loadMediabunny();
      if (await mb.canEncodeAudio("aac").catch(() => false)) return;
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
    })().catch((error) => {
      aacRegistered = null;
      throw error;
    });
  }
  return aacRegistered;
}

async function openInput(file: Blob) {
  const mb = await loadMediabunny();
  return new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
}

export async function probeMedia(file: Blob): Promise<MediaInfo | null> {
  try {
    const input = await openInput(file);
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    let frameRate: number | null = null;
    if (video) {
      try {
        const stats = await video.computePacketStats(90);
        frameRate = stats.averagePacketRate || null;
      } catch {
        frameRate = null;
      }
    }
    return {
      duration,
      width: video ? await video.getDisplayWidth() : 0,
      height: video ? await video.getDisplayHeight() : 0,
      hasVideo: Boolean(video),
      hasAudio: Boolean(audio),
      frameRate,
    };
  } catch {
    return null;
  }
}

/**
 * Decode the primary audio track to mono Float32 at 16 kHz. Uses WebCodecs via
 * Mediabunny (streams, low memory) and falls back to Web Audio decoding.
 */
export async function decodeSpeechPcm(file: Blob, onProgress?: (value: number) => void): Promise<Float32Array> {
  try {
    return await decodeWithMediabunny(file, onProgress);
  } catch (error) {
    try {
      return await decodeWithWebAudio(file);
    } catch {
      throw error instanceof Error ? error : new Error("Could not read audio from this file.");
    }
  }
}

async function decodeWithMediabunny(file: Blob, onProgress?: (value: number) => void): Promise<Float32Array> {
  const mb = await loadMediabunny();
  const input = await openInput(file);
  const track = await input.getPrimaryAudioTrack();
  if (!track) throw new Error("This file has no audio track.");
  if (!(await track.canDecode())) throw new Error("This browser cannot decode the audio in this file.");
  const duration = Math.max(0.1, await track.computeDuration());
  const total = Math.ceil(duration * SPEECH_RATE) + SPEECH_RATE;
  let out = new Float32Array(total);
  let written = 0;
  const sink = new mb.AudioBufferSink(track);
  // Box-filter resampler state.
  for await (const wrapped of sink.buffers()) {
    const buffer = wrapped.buffer;
    const rate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const data: Float32Array[] = [];
    for (let channel = 0; channel < channels; channel += 1) data.push(buffer.getChannelData(channel));
    const startIndex = Math.max(0, Math.round(wrapped.timestamp * SPEECH_RATE));
    const ratio = rate / SPEECH_RATE;
    const outCount = Math.floor(length / ratio);
    if (startIndex + outCount > out.length) {
      const grown = new Float32Array(Math.ceil((startIndex + outCount) * 1.2));
      grown.set(out);
      out = grown;
    }
    for (let index = 0; index < outCount; index += 1) {
      const from = Math.floor(index * ratio);
      const to = Math.min(length, Math.max(from + 1, Math.floor((index + 1) * ratio)));
      let sum = 0;
      for (let k = from; k < to; k += 1) {
        let mixed = 0;
        for (let channel = 0; channel < channels; channel += 1) mixed += data[channel][k];
        sum += mixed / channels;
      }
      out[startIndex + index] = sum / (to - from);
    }
    written = Math.max(written, startIndex + outCount);
    onProgress?.(Math.min(1, wrapped.timestamp / duration));
  }
  onProgress?.(1);
  if (!written) throw new Error("The audio track is empty.");
  return out.subarray(0, written);
}

async function decodeWithWebAudio(file: Blob): Promise<Float32Array> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    const length = Math.ceil(decoded.duration * SPEECH_RATE);
    const offline = new OfflineAudioContext(1, Math.max(1, length), SPEECH_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    await context.close().catch(() => undefined);
  }
}

/** Peak envelope for the waveform, `perSecond` bars per second of audio. */
export function peaksFromPcm(pcm: Float32Array, perSecond = 40): number[] {
  const size = Math.max(1, Math.floor(SPEECH_RATE / perSecond));
  const bars = Math.ceil(pcm.length / size);
  const peaks: number[] = new Array(bars);
  let max = 0.0001;
  for (let bar = 0; bar < bars; bar += 1) {
    let peak = 0;
    const start = bar * size;
    const end = Math.min(pcm.length, start + size);
    for (let index = start; index < end; index += 2) {
      const value = Math.abs(pcm[index]);
      if (value > peak) peak = value;
    }
    peaks[bar] = peak;
    if (peak > max) max = peak;
  }
  // Normalise so quiet recordings are still readable.
  const scale = 1 / max;
  return peaks.map((value) => Math.min(1, Math.sqrt(value * scale)));
}

/** Choose chunk boundaries (seconds) near `target` length, preferring quiet moments. */
export function planChunks(pcm: Float32Array, target: number): { start: number; end: number }[] {
  const duration = pcm.length / SPEECH_RATE;
  if (duration <= target + 5) return [{ start: 0, end: duration }];
  const chunks: { start: number; end: number }[] = [];
  let start = 0;
  const window = Math.floor(SPEECH_RATE * 0.05);
  while (duration - start > target + 5) {
    const ideal = start + target;
    const searchFrom = Math.max(start + target * 0.7, ideal - 6);
    const searchTo = Math.min(duration - 1, ideal);
    let best = ideal;
    let bestEnergy = Infinity;
    for (let t = searchFrom; t <= searchTo; t += 0.05) {
      const from = Math.floor(t * SPEECH_RATE);
      let energy = 0;
      for (let index = from; index < from + window && index < pcm.length; index += 1) energy += pcm[index] * pcm[index];
      if (energy < bestEnergy) {
        bestEnergy = energy;
        best = t;
      }
    }
    chunks.push({ start, end: best });
    start = best;
  }
  chunks.push({ start, end: duration });
  return chunks;
}

export function wavFromPcm(pcm: Float32Array, rate = SPEECH_RATE): Blob {
  const dataSize = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let index = 0; index < pcm.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

let opusOk: Promise<boolean> | null = null;
export function canEncodeSpeechOpus(): Promise<boolean> {
  if (!opusOk) {
    opusOk = (async () => {
      try {
        const mb = await loadMediabunny();
        return await mb.canEncodeAudio("opus", { numberOfChannels: 1, sampleRate: 48000, bitrate: 32000 });
      } catch {
        return false;
      }
    })();
  }
  return opusOk;
}

/** Encode a PCM slice as compact Ogg/Opus (≈4 KB/s) when the browser can, else WAV. */
export async function encodeSpeechChunk(pcm: Float32Array): Promise<{ blob: Blob; name: string }> {
  if (await canEncodeSpeechOpus()) {
    try {
      const mb = await loadMediabunny();
      const output = new mb.Output({ format: new mb.OggOutputFormat(), target: new mb.BufferTarget() });
      const source = new mb.AudioBufferSource({ codec: "opus", bitrate: 32000 });
      output.addAudioTrack(source);
      await output.start();
      // Opus encoders are happiest at 48 kHz: upsample ×3 (linear), 10 s at a
      // time so a long chunk never needs one huge buffer.
      const slice = SPEECH_RATE * 10;
      for (let from = 0; from < pcm.length; from += slice) {
        const to = Math.min(pcm.length, from + slice);
        const audioBuffer = new AudioBuffer({ length: Math.max(1, (to - from) * 3), numberOfChannels: 1, sampleRate: 48000 });
        const channel = audioBuffer.getChannelData(0);
        for (let index = from; index < to; index += 1) {
          const a = pcm[index];
          const b = index + 1 < pcm.length ? pcm[index + 1] : a;
          const at = (index - from) * 3;
          channel[at] = a;
          channel[at + 1] = a + (b - a) / 3;
          channel[at + 2] = a + ((b - a) * 2) / 3;
        }
        await source.add(audioBuffer);
      }
      await output.finalize();
      const bytes = output.target.buffer;
      if (bytes && bytes.byteLength > 0) return { blob: new Blob([bytes], { type: "audio/ogg" }), name: "speech.ogg" };
    } catch {
      /* fall back to WAV */
    }
  }
  return { blob: wavFromPcm(pcm), name: "speech.wav" };
}

/** Small thumbnails across the clip for the timeline filmstrip. */
export async function filmstrip(
  file: Blob,
  count: number,
  height: number,
  onFrame: (index: number, url: string) => void,
): Promise<void> {
  const mb = await loadMediabunny();
  const input = await openInput(file);
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(await track.canDecode())) return;
  const duration = await input.computeDuration();
  const sink = new mb.CanvasSink(track, { height, fit: "contain", poolSize: 2 });
  const times = Array.from({ length: count }, (_, index) => ((index + 0.5) / count) * duration);
  let index = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(times)) {
    if (wrapped) {
      const canvas = wrapped.canvas as HTMLCanvasElement | OffscreenCanvas;
      let url = "";
      if ("toDataURL" in canvas) url = canvas.toDataURL("image/jpeg", 0.6);
      else {
        const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality: 0.6 });
        url = URL.createObjectURL(blob);
      }
      onFrame(index, url);
    }
    index += 1;
  }
}

/**
 * Pull the audio out of a video. "m4a" copies the original AAC stream when it
 * can (no quality loss, near-instant); "wav" writes uncompressed PCM.
 */
export async function extractAudio(
  file: Blob,
  format: "m4a" | "wav",
  onProgress?: (value: number) => void,
): Promise<Blob> {
  const mb = await loadMediabunny();
  if (format === "m4a") await ensureAac().catch(() => undefined);
  const input = await openInput(file);
  const output = new mb.Output({
    format: format === "m4a" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WavOutputFormat(),
    target: new mb.BufferTarget(),
  });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: { discard: true },
    audio: format === "m4a" ? { codec: "aac" } : { codec: "pcm-s16" },
  });
  if (!conversion.isValid) throw new Error("This file's audio could not be extracted in this browser.");
  conversion.onProgress = (value) => onProgress?.(value);
  await conversion.execute();
  const bytes = output.target.buffer;
  if (!bytes) throw new Error("Audio extraction produced no data.");
  return new Blob([bytes], { type: format === "m4a" ? "audio/mp4" : "audio/wav" });
}
