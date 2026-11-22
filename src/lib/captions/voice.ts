import type { VoiceMix } from "@/lib/captions/types";

type Graph = {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  highpass: BiquadFilterNode;
  presence: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
};

let graph: Graph | null = null;
let bound: HTMLMediaElement | null = null;

export function ensureVoice(media: HTMLMediaElement) {
  if (graph && bound === media) return graph;
  const ctx = new AudioContext();
  const source = ctx.createMediaElementSource(media);
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 20;
  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 3200;
  presence.Q.value = 0.9;
  presence.gain.value = 0;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = 0;
  compressor.knee.value = 12;
  compressor.ratio.value = 1;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;
  source.connect(highpass);
  highpass.connect(presence);
  presence.connect(compressor);
  compressor.connect(ctx.destination);
  graph = { ctx, source, highpass, presence, compressor };
  bound = media;
  return graph;
}

export function applyVoice(mix: VoiceMix) {
  if (!graph) return;
  const { highpass, presence, compressor } = graph;
  if (!mix.clean) {
    highpass.frequency.value = 20;
    presence.gain.value = 0;
    compressor.threshold.value = 0;
    compressor.ratio.value = 1;
    return;
  }
  highpass.frequency.value = mix.rumble;
  presence.gain.value = mix.presence;
  compressor.threshold.value = -26;
  compressor.ratio.value = 2 + mix.compress * 8;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.16;
}

export function resumeVoice() {
  if (graph && graph.ctx.state === "suspended") void graph.ctx.resume();
}
