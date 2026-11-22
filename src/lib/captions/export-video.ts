/**
 * MP4 export. Decodes the original file with WebCodecs, paints every frame
 * (fit, colour grade, captions) on a canvas and encodes H.264 + AAC into a real
 * .mp4 — faster than real time on most laptops, at the source frame rate and
 * the size you pick. Falls back to real-time recording when WebCodecs is
 * missing.
 */
import { drawCaptions, ensureFont } from "@/lib/captions/render";
import { ensureAac, loadMediabunny } from "@/lib/captions/media-engine";
import type { Lut } from "@/lib/captions/luts";
import { keptRanges } from "@/lib/captions/store";
import type { CaptionLook, Cut, FitMode, Project } from "@/lib/captions/types";
import { frameRatio } from "@/lib/captions/types";

export type ExportResolution = "original" | "1080" | "720";
export type ExportFps = "source" | 30 | 60;

export type ExportSettings = {
  resolution: ExportResolution;
  fps: ExportFps;
  quality: "high" | "max" | "small";
  captions: boolean;
};

export type ExportJob = {
  file: File;
  project: Project;
  grade: Lut;
  settings: ExportSettings;
  onProgress: (value: number, label?: string) => void;
  signal?: AbortSignal;
};

export type ExportResult = {
  blob: Blob;
  width: number;
  height: number;
  codec: string;
  extension: "mp4" | "webm";
  fps: number;
};

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

/** Output size for a source size, project frame and chosen resolution. */
export function outputSize(
  source: { width: number; height: number } | null,
  aspect: Project["aspect"],
  resolution: ExportResolution,
): { width: number; height: number } {
  const srcW = source?.width || 1080;
  const srcH = source?.height || 1920;
  const ratio = frameRatio(aspect, source && source.width ? source : null);
  let short: number;
  if (resolution === "1080") short = 1080;
  else if (resolution === "720") short = 720;
  else short = Math.min(2160, Math.min(srcW, srcH));
  if (aspect === "original" && resolution === "original") return { width: even(srcW), height: even(srcH) };
  if (ratio >= 1) return { width: even(short * ratio), height: even(short) };
  return { width: even(short), height: even(short / ratio) };
}

function pickFps(source: number | null, choice: ExportFps): number {
  if (choice !== "source") return choice;
  if (!source || !Number.isFinite(source)) return 30;
  const common = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  let best = 30;
  for (const value of common) if (Math.abs(value - source) < Math.abs(best - source)) best = value;
  return Math.min(60, best);
}

type Frame = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Paint one picture frame: background (blurred fill / black / gradient),
 * the video fitted into the frame, the grade, and the colour wash.
 */
export function paintPicture(
  ctx: Frame,
  draw: ((ctx: Frame, x: number, y: number, w: number, h: number) => void) | null,
  srcW: number,
  srcH: number,
  W: number,
  H: number,
  fit: FitMode,
  grade: Lut,
  blurCanvas: HTMLCanvasElement | OffscreenCanvas | null,
) {
  ctx.save();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  if (!draw || !srcW || !srcH) {
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#1e1b4b");
    gradient.addColorStop(0.55, "#0f172a");
    gradient.addColorStop(1, "#3b0764");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const cover = Math.max(W / srcW, H / srcH);
  const contain = Math.min(W / srcW, H / srcH);
  const filter = grade.filter && grade.filter !== "none" ? grade.filter : "none";
  if (fit === "blur" && blurCanvas && Math.abs(srcW / srcH - W / H) > 0.01) {
    const bctx = blurCanvas.getContext("2d") as Frame | null;
    if (bctx) {
      const bw = blurCanvas.width;
      const bh = blurCanvas.height;
      const s = Math.max(bw / srcW, bh / srcH);
      bctx.filter = filter;
      draw(bctx, (bw - srcW * s) / 2, (bh - srcH * s) / 2, srcW * s, srcH * s);
      bctx.filter = "none";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(blurCanvas, -W * 0.04, -H * 0.04, W * 1.08, H * 1.08);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, W, H);
    }
  }
  const scale = fit === "cover" ? cover : contain;
  const dw = srcW * scale;
  const dh = srcH * scale;
  ctx.filter = filter;
  draw(ctx, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.filter = "none";
  if (grade.wash && grade.washOpacity > 0) {
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = grade.washOpacity;
    ctx.fillStyle = grade.wash;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function blurBuffer(W: number, H: number) {
  return makeCanvas(Math.max(8, Math.round(W / 22)), Math.max(8, Math.round(H / 22)));
}

export async function webCodecsAvailable(): Promise<boolean> {
  return typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";
}

export async function exportVideo(job: ExportJob): Promise<ExportResult> {
  if (await webCodecsAvailable()) {
    try {
      return await exportWithWebCodecs(job);
    } catch (error) {
      if (job.signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      // Fall back only for capability problems, not for user cancellation.
      if (!/codec|encod|decod|support|config/i.test(message)) throw error;
    }
  }
  throw new Error("REALTIME_FALLBACK");
}

async function exportWithWebCodecs(job: ExportJob): Promise<ExportResult> {
  const { file, project, grade, settings, onProgress, signal } = job;
  const mb = await loadMediabunny();
  onProgress(0, "Opening video…");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const videoTrack = await input.getPrimaryVideoTrack();
  const audioTrack = await input.getPrimaryAudioTrack();
  const duration = await input.computeDuration();
  if (!duration) throw new Error("This file has no playable media.");
  const canVideo = videoTrack ? await videoTrack.canDecode() : false;
  if (videoTrack && !canVideo) throw new Error("This browser cannot decode the video codec of this file.");

  const srcW = videoTrack ? await videoTrack.getDisplayWidth() : 0;
  const srcH = videoTrack ? await videoTrack.getDisplayHeight() : 0;
  let sourceFps: number | null = null;
  if (videoTrack) {
    try {
      sourceFps = (await videoTrack.computePacketStats(120)).averagePacketRate;
    } catch {
      sourceFps = null;
    }
  }
  const { width: W, height: H } = outputSize(srcW ? { width: srcW, height: srcH } : null, project.aspect, settings.resolution);
  const fps = pickFps(sourceFps, settings.fps);

  const quality =
    settings.quality === "max" ? mb.QUALITY_VERY_HIGH : settings.quality === "small" ? mb.QUALITY_MEDIUM : mb.QUALITY_HIGH;
  const codec = await mb.getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"], { width: W, height: H, quality });
  if (!codec) throw new Error("This browser cannot encode video (no supported codec).");
  const container: "mp4" | "webm" = codec === "avc" || codec === "hevc" || codec === "av1" || codec === "vp9" ? "mp4" : "webm";

  const output = new mb.Output({
    format: container === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(),
    target: new mb.BufferTarget(),
  });
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d", { alpha: false }) as Frame | null;
  if (!ctx) throw new Error("Could not create a drawing surface.");
  const videoSource = new mb.CanvasSource(canvas, { codec, quality, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: InstanceType<typeof mb.AudioBufferSource> | null = null;
  if (audioTrack && (await audioTrack.canDecode())) {
    const audioCodec = container === "mp4" ? "aac" : "opus";
    if (audioCodec === "aac") await ensureAac().catch(() => undefined);
    if (await mb.canEncodeAudio(audioCodec).catch(() => false)) {
      audioSource = new mb.AudioBufferSource({ codec: audioCodec, quality: mb.QUALITY_HIGH });
      output.addAudioTrack(audioSource);
    }
  }

  const abort = async () => {
    await output.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", () => void abort(), { once: true });

  await ensureFont(project.look);
  await output.start();

  const cuts: Cut[] = project.cuts ?? [];
  const ranges = keptRanges(duration, cuts);
  const total = ranges.reduce((sum, range) => sum + (range.end - range.start), 0) || duration;
  const look: CaptionLook = project.look;
  const fit = project.fit ?? "blur";
  const blur = blurBuffer(W, H);
  const showCaptions = settings.captions && !project.captionsHidden;
  const keyOnly = project.captionMode === "key";
  let videoDone = 0;
  let audioDone = audioSource ? 0 : 1;
  const report = () => onProgress(Math.min(0.99, videoDone * 0.85 + audioDone * 0.15), "Rendering MP4…");

  const videoJob = (async () => {
    const step = 1 / fps;
    const times: { source: number; out: number }[] = [];
    let out = 0;
    for (const range of ranges) {
      for (let t = range.start; t < range.end - step * 0.25; t += step) {
        times.push({ source: t, out });
        out += step;
      }
    }
    const paint = (sourceTime: number, sample: { draw: (c: Frame, x: number, y: number, w: number, h: number) => void } | null) => {
      paintPicture(ctx, sample ? (c, x, y, w, h) => sample.draw(c, x, y, w, h) : null, srcW, srcH, W, H, fit, grade, blur);
      if (showCaptions) drawCaptions(ctx, project.words, sourceTime, look, W, H, { keyOnly, cuts });
    };
    if (videoTrack) {
      const sink = new mb.VideoSampleSink(videoTrack);
      let index = 0;
      let last: InstanceType<typeof mb.VideoSample> | null = null;
      for await (const sample of sink.samplesAtTimestamps(times.map((item) => item.source))) {
        if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
        const slot = times[index];
        index += 1;
        if (sample) {
          if (last && last !== sample) last.close();
          last = sample;
        }
        paint(slot.source, last);
        await videoSource.add(slot.out, step);
        videoDone = index / times.length;
        if (index % 6 === 0) report();
      }
      last?.close();
    } else {
      for (let index = 0; index < times.length; index += 1) {
        if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
        paint(times[index].source, null);
        await videoSource.add(times[index].out, step);
        videoDone = (index + 1) / times.length;
        if (index % 6 === 0) report();
      }
    }
    videoSource.close();
  })();

  const audioJob = (async () => {
    if (!audioSource || !audioTrack) return;
    const sink = new mb.AudioBufferSink(audioTrack);
    let written = 0;
    for (const range of ranges) {
      for await (const wrapped of sink.buffers(range.start, range.end)) {
        if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
        const buffer = wrapped.buffer;
        const rate = buffer.sampleRate;
        const from = Math.max(0, Math.round((range.start - wrapped.timestamp) * rate));
        const to = Math.min(buffer.length, Math.round((range.end - wrapped.timestamp) * rate));
        if (to - from <= 0) continue;
        let piece = buffer;
        if (from > 0 || to < buffer.length) {
          piece = new AudioBuffer({ length: to - from, numberOfChannels: buffer.numberOfChannels, sampleRate: rate });
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            piece.copyToChannel(buffer.getChannelData(channel).subarray(from, to), channel);
          }
        }
        await audioSource.add(piece);
        written += piece.duration;
        audioDone = Math.min(1, written / total);
      }
    }
    audioSource.close();
  })();

  try {
    await Promise.all([videoJob, audioJob]);
    onProgress(0.995, "Finishing file…");
    await output.finalize();
  } catch (error) {
    await abort();
    throw error;
  }
  const bytes = output.target.buffer;
  if (!bytes) throw new Error("The encoder produced no data.");
  onProgress(1, "Done");
  return {
    blob: new Blob([bytes], { type: container === "mp4" ? "video/mp4" : "video/webm" }),
    width: W,
    height: H,
    codec: codec === "avc" ? "H.264" : codec.toUpperCase(),
    extension: container,
    fps,
  };
}

/**
 * Real-time fallback for browsers without WebCodecs: plays the video once and
 * records the canvas. Produces MP4 where MediaRecorder supports it (Chrome 126+,
 * Safari), WebM otherwise.
 */
export async function exportRealtime(
  video: HTMLVideoElement,
  project: Project,
  grade: Lut,
  settings: ExportSettings,
  onProgress: (value: number, label?: string) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  if (typeof MediaRecorder === "undefined") throw new Error("This browser cannot export video. Try Chrome or Edge.");
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  const { width: W, height: H } = outputSize(srcW ? { width: srcW, height: srcH } : null, project.aspect, settings.resolution);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") throw new Error("This browser cannot record a canvas.");
  await ensureFont(project.look);
  const candidates = [
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mime = candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "video/webm";
  const extension: "mp4" | "webm" = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const fps = settings.fps === "source" ? 30 : settings.fps;
  const stream = canvas.captureStream(fps);
  const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
  if (capture) {
    try {
      for (const track of capture.call(video).getAudioTracks()) stream.addTrack(track);
    } catch {
      /* silent export */
    }
  }
  const bitrate = W * H * fps * 0.12;
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(bitrate) });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const blur = blurBuffer(W, H);
  const cuts = project.cuts ?? [];
  const duration = video.duration || 0;
  const ranges = keptRanges(duration, cuts);
  const fit = project.fit ?? "blur";
  video.pause();
  video.currentTime = ranges[0]?.start ?? 0;
  await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
  recorder.start(250);
  await video.play();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) {
        video.pause();
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }
      const t = video.currentTime;
      const cut = cuts.find((item) => t >= item.start && t < item.end - 0.04);
      if (cut) {
        video.currentTime = cut.end;
        requestAnimationFrame(tick);
        return;
      }
      paintPicture(ctx, (c, x, y, w, h) => c.drawImage(video, x, y, w, h), srcW, srcH, W, H, fit, grade, blur);
      if (settings.captions && !project.captionsHidden) {
        drawCaptions(ctx, project.words, t, project.look, W, H, { keyOnly: project.captionMode === "key", cuts });
      }
      if (duration) onProgress(Math.min(0.99, t / duration), "Recording in real time…");
      if (video.ended || video.paused) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await stopped;
  onProgress(1, "Done");
  return {
    blob: new Blob(chunks, { type: extension === "mp4" ? "video/mp4" : "video/webm" }),
    width: W,
    height: H,
    codec: extension === "mp4" ? "H.264" : "VP8/VP9",
    extension,
    fps,
  };
}
