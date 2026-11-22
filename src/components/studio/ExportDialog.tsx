import { Button } from "@/components/ui/button";
import { exportRealtime, exportVideo, outputSize, type ExportFps, type ExportResolution, type ExportResult } from "@/lib/captions/export-video";
import { downloadBlob, downloadText, safeName, toJson, toPlain, toSrt, toVtt } from "@/lib/captions/io";
import { lutById } from "@/lib/captions/luts";
import { mediaBridge } from "@/lib/captions/media";
import { extractAudio } from "@/lib/captions/media-engine";
import { useStudio } from "@/lib/captions/store";
import { CheckCircle2, Download, FileText, Film, Music2, X } from "lucide-react";
import { useRef, useState } from "react";

type Job = { label: string; progress: number } | null;

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useStudio((state) => state.project);
  const media = useStudio((state) => state.media);
  const kind = useStudio((state) => state.mediaKind);
  const [fps, setFps] = useState<ExportFps>("source");
  const [quality, setQuality] = useState<"high" | "max" | "small">("high");
  const [captions, setCaptions] = useState(true);
  const [job, setJob] = useState<Job>(null);
  const [done, setDone] = useState<(ExportResult & { name: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (!open) return null;
  const hasFile = Boolean(mediaBridge.file);
  const source = media && media.width ? { width: media.width, height: media.height } : null;
  const sizes: { id: ExportResolution; title: string; hint: string }[] = [
    { id: "original", title: "Original quality", hint: "Same size as your upload" },
    { id: "1080", title: "Full HD 1080p", hint: "Best for Reels, TikTok, YouTube" },
    { id: "720", title: "HD 720p", hint: "Smaller file, quick to share" },
  ];

  async function run(resolution: ExportResolution) {
    const file = mediaBridge.file;
    if (!file) {
      setError("Upload a video first. You can still download subtitles below.");
      return;
    }
    setError(null);
    setDone(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const state = useStudio.getState();
    const settings = { resolution, fps, quality, captions };
    const grade = lutById(state.project.gradeId);
    setJob({ label: "Preparing…", progress: 0 });
    state.setPlaying(false);
    mediaBridge.video?.pause();
    try {
      let result: ExportResult;
      try {
        result = await exportVideo({
          file,
          project: state.project,
          grade,
          settings,
          signal: controller.signal,
          onProgress: (progress, label) => setJob({ label: label ?? "Rendering…", progress }),
        });
      } catch (failure) {
        if (!(failure instanceof Error) || failure.message !== "REALTIME_FALLBACK" || !mediaBridge.video) throw failure;
        setJob({ label: "Recording in real time…", progress: 0 });
        result = await exportRealtime(mediaBridge.video, state.project, grade, settings, (progress, label) => setJob({ label: label ?? "Recording…", progress }), controller.signal);
      }
      const name = `${safeName(state.project.name)}-${resolution === "original" ? `${result.width}x${result.height}` : `${resolution}p`}.${result.extension}`;
      downloadBlob(name, result.blob);
      setDone({ ...result, name });
      state.setNote(`Exported ${name} (${(result.blob.size / 1048576).toFixed(1)} MB, ${result.codec}).`);
    } catch (failure) {
      if (controller.signal.aborted) setError("Export cancelled.");
      else setError(failure instanceof Error ? failure.message : "Export failed.");
    } finally {
      setJob(null);
      abortRef.current = null;
    }
  }

  function subtitles(kind: "srt" | "words" | "vtt" | "json" | "txt") {
    const current = useStudio.getState().project;
    const base = safeName(current.name);
    if (kind === "srt") downloadText(`${base}.srt`, toSrt(current.words, current.look.wordsPerCue), "application/x-subrip");
    if (kind === "words") downloadText(`${base}.words.srt`, toSrt(current.words, 1, true), "application/x-subrip");
    if (kind === "vtt") downloadText(`${base}.vtt`, toVtt(current.words, current.look.wordsPerCue), "text/vtt");
    if (kind === "json") downloadText(`${base}.json`, toJson(current.name, current.words), "application/json");
    if (kind === "txt") downloadText(`${base}.txt`, toPlain(current.words), "text/plain");
  }

  async function audio(format: "m4a" | "wav") {
    const file = mediaBridge.file;
    if (!file) {
      setError("Upload a video first.");
      return;
    }
    setJob({ label: `Extracting ${format.toUpperCase()}…`, progress: 0 });
    try {
      const blob = await extractAudio(file, format, (progress) => setJob({ label: `Extracting ${format.toUpperCase()}…`, progress }));
      downloadBlob(`${safeName(useStudio.getState().project.name)}-audio.${format}`, blob);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not extract audio.");
    } finally {
      setJob(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !job) onClose();
      }}
    >
      <div className="gradient-border fade-up relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 shadow-2xl">
        {!job ? (
          <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded-full p-2 text-muted hover:bg-white/5" aria-label="Close">
            <X className="size-4" />
          </button>
        ) : null}
        <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-accent-2 uppercase">
          <Film className="size-3.5" /> Export
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">Download your video as MP4</h2>
        <p className="mt-1 text-sm text-muted">
          Captions, colour grade and cuts are burned in. H.264 + AAC — plays everywhere: Instagram, TikTok, YouTube, WhatsApp.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {sizes.map((size) => {
            const out = outputSize(source, project.aspect, size.id);
            return (
              <button
                key={size.id}
                type="button"
                data-testid={`export-${size.id}`}
                disabled={Boolean(job) || !hasFile}
                onClick={() => void run(size.id)}
                className={`group rounded-xl border p-3 text-left transition disabled:opacity-50 ${size.id === "original" ? "border-accent/70 bg-accent/10" : "border-line hover:border-white/30"}`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{size.title}</span>
                  <Download className="size-4 text-muted transition group-hover:text-fg" />
                </span>
                <span className="mt-1 block font-mono text-xs text-accent-2">
                  {out.width}×{out.height} · MP4
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">{size.hint}</span>
              </button>
            );
          })}
        </div>
        {!hasFile ? <p className="mt-2 text-xs text-amber-200">Upload a video in the studio to enable MP4 export. Subtitle files work right away.</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            Frame rate
            <select className="h-8 rounded-lg border border-line bg-surface px-2 text-fg" value={String(fps)} onChange={(event) => setFps(event.target.value === "source" ? "source" : (Number(event.target.value) as 30 | 60))} disabled={Boolean(job)}>
              <option value="source">Same as original</option>
              <option value="30">30 fps</option>
              <option value="60">60 fps</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            Quality
            <select className="h-8 rounded-lg border border-line bg-surface px-2 text-fg" value={quality} onChange={(event) => setQuality(event.target.value as "high" | "max" | "small")} disabled={Boolean(job)}>
              <option value="high">High</option>
              <option value="max">Maximum</option>
              <option value="small">Smaller file</option>
            </select>
          </label>
          <button
            type="button"
            disabled={Boolean(job)}
            onClick={() => setCaptions((value) => !value)}
            className={`h-8 rounded-lg border px-2.5 ${captions ? "border-accent bg-accent/10 text-fg" : "border-line text-muted"}`}
          >
            {captions ? "Captions burned in" : "No captions (clean video)"}
          </button>
          {kind === "audio" ? <span className="text-muted">Audio file: captions render on a gradient background.</span> : null}
        </div>

        {job ? (
          <div className="mt-4 rounded-xl border border-line bg-black/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span>{job.label}</span>
              <span className="font-mono text-accent-2">{Math.round(job.progress * 100)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
            </div>
            <Button tone="ghost" size="xs" className="mt-2" onClick={() => abortRef.current?.abort()}>
              Cancel
            </Button>
          </div>
        ) : null}
        {done ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="size-4 text-emerald-300" />
            <span className="flex-1">
              {done.name} · {done.width}×{done.height} · {done.fps} fps · {(done.blob.size / 1048576).toFixed(1)} MB
            </span>
            <Button tone="line" size="xs" onClick={() => downloadBlob(done.name, done.blob)}>
              Download again
            </Button>
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-2.5 text-xs text-rose-100">{error}</p> : null}

        <div className="mt-5 grid gap-4 border-t border-white/5 pt-4 sm:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted uppercase">
              <FileText className="size-3.5" /> Subtitle files
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button tone="line" size="xs" onClick={() => subtitles("srt")}>
                SRT
              </Button>
              <Button tone="line" size="xs" onClick={() => subtitles("words")}>
                Word-level SRT
              </Button>
              <Button tone="line" size="xs" onClick={() => subtitles("vtt")}>
                VTT
              </Button>
              <Button tone="line" size="xs" onClick={() => subtitles("txt")}>
                TXT
              </Button>
              <Button tone="line" size="xs" onClick={() => subtitles("json")}>
                JSON
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Use SRT in Premiere Pro, DaVinci Resolve, CapCut or YouTube.</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted uppercase">
              <Music2 className="size-3.5" /> Audio only
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button tone="line" size="xs" disabled={!hasFile || Boolean(job)} onClick={() => void audio("m4a")}>
                M4A (original)
              </Button>
              <Button tone="line" size="xs" disabled={!hasFile || Boolean(job)} onClick={() => void audio("wav")}>
                WAV
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
