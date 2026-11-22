import type { MediaInfo } from "@/lib/captions/media-engine";

export const mediaBridge: {
  video: HTMLVideoElement | null;
  file: File | null;
  url: string | null;
  info: MediaInfo | null;
  /** 16 kHz mono voice track, decoded once per file. */
  pcm: Promise<Float32Array> | null;
} = {
  video: null,
  file: null,
  url: null,
  info: null,
  pcm: null,
};

export function releaseMedia() {
  if (mediaBridge.url) URL.revokeObjectURL(mediaBridge.url);
  mediaBridge.url = null;
  mediaBridge.file = null;
  mediaBridge.info = null;
  mediaBridge.pcm = null;
}

/** Seek the picture and the studio playhead together. */
export function seekTo(time: number) {
  const video = mediaBridge.video;
  if (video && mediaBridge.url && Number.isFinite(time)) {
    try {
      video.currentTime = Math.max(0, time);
    } catch {
      /* not seekable yet */
    }
  }
}
