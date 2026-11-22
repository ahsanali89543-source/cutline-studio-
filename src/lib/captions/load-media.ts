import { mediaBridge, releaseMedia } from "@/lib/captions/media";
import { filmstrip, peaksFromPcm, probeMedia } from "@/lib/captions/media-engine";
import { keepMediaWithProject, prepareProjectForMedia } from "@/lib/captions/projects";
import { useStudio } from "@/lib/captions/store";
import { speechPcm } from "@/lib/captions/transcribe-client";

const PEAK_RATE = 50;

async function toDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

/** A small poster frame for the project's card in My Recent Projects. */
async function makePoster(file: File, projectId: string) {
  let picked = "";
  await filmstrip(file, 6, 220, (index, url) => {
    if (index === 0) picked = url;
    else if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  });
  if (!picked) return;
  const poster = await toDataUrl(picked);
  const state = useStudio.getState();
  if (poster && mediaBridge.file === file && state.project.id === projectId) state.setProjectThumb(poster);
}

/**
 * Attach a video/audio file to the studio: picture, metadata, waveform, filmstrip.
 * `restore` is used when a saved project is reopened with its own file — the
 * project is not renamed and the file is not saved again.
 */
export async function loadMediaFile(file: File, options: { restore?: boolean } = {}) {
  const studio = useStudio.getState();
  if (!options.restore) prepareProjectForMedia(file);
  releaseMedia();
  const url = URL.createObjectURL(file);
  mediaBridge.file = file;
  mediaBridge.url = url;
  const video = mediaBridge.video;
  if (video) {
    video.src = url;
    video.load();
  }
  const isAudio = file.type.startsWith("audio") || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(file.name);
  studio.setMedia({ duration: null, kind: isAudio ? "audio" : "video", name: file.name });
  studio.setMediaMeta(null);
  studio.setPeaks([], PEAK_RATE);
  studio.setThumbs([]);
  studio.selectSegment(null);
  if (!options.restore) {
    const words = useStudio.getState().project.words.length;
    studio.setNote(words ? `${file.name} is attached to this project.` : `${file.name} is loaded. Press Transcribe — Roman Urdu is selected by default.`);
    void keepMediaWithProject(file);
  }

  const info = await probeMedia(file);
  if (mediaBridge.file !== file) return;
  if (info) {
    mediaBridge.info = info;
    useStudio.getState().setMediaMeta({
      width: info.width,
      height: info.height,
      duration: info.duration,
      hasVideo: info.hasVideo,
      hasAudio: info.hasAudio,
      frameRate: info.frameRate,
    });
    if (!useStudio.getState().mediaDuration && info.duration) {
      useStudio.getState().setMedia({ duration: info.duration, kind: info.hasVideo ? "video" : "audio", name: file.name });
    }
  }

  // Waveform (and the cached voice track for transcription) in the background.
  if (!info || info.hasAudio) {
    void speechPcm()
      .then((pcm) => {
        if (mediaBridge.file !== file) return;
        useStudio.getState().setPeaks(peaksFromPcm(pcm, PEAK_RATE), PEAK_RATE);
      })
      .catch(() => {
        if (mediaBridge.file === file) useStudio.getState().setNote("Could not read the audio track for the waveform. Transcription may still work.");
      });
  }

  // Filmstrip thumbnails.
  if (info?.hasVideo) {
    const count = Math.min(90, Math.max(12, Math.round(info.duration / 1.5)));
    const thumbs: string[] = new Array(count).fill("");
    let pending = 0;
    void filmstrip(file, count, 72, (index, thumb) => {
      if (mediaBridge.file !== file) return;
      thumbs[index] = thumb;
      pending += 1;
      if (pending % 6 === 0 || index === count - 1) useStudio.getState().setThumbs([...thumbs]);
    })
      .then(() => {
        if (mediaBridge.file !== file) return;
        useStudio.getState().setThumbs([...thumbs]);
        const project = useStudio.getState().project;
        if (!project.thumb) void makePoster(file, project.id).catch(() => undefined);
      })
      .catch(() => undefined);
  }
}
