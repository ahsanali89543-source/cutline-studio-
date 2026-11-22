import { CaptionOverlay } from "@/components/captions/CaptionOverlay";
import { Button } from "@/components/ui/button";
import { loadMediaFile } from "@/lib/captions/load-media";
import { lutById } from "@/lib/captions/luts";
import { mediaBridge, seekTo } from "@/lib/captions/media";
import { useStudio } from "@/lib/captions/store";
import { formatTime, projectSpan } from "@/lib/captions/timing";
import { frameRatio } from "@/lib/captions/types";
import { applyVoice, ensureVoice, resumeVoice } from "@/lib/captions/voice";
import { Captions, CaptionsOff, Maximize2, Pause, Play, RotateCcw, Upload, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Player({ autoOpen = false }: { autoOpen?: boolean }) {
  const project = useStudio((state) => state.project);
  const playhead = useStudio((state) => state.playhead);
  const playing = useStudio((state) => state.playing);
  const mediaDuration = useStudio((state) => state.mediaDuration);
  const media = useStudio((state) => state.media);
  const kind = useStudio((state) => state.mediaKind);
  // Media can arrive from the upload button, a drop on the timeline, or a reopened project.
  const attached = kind !== null;
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLCanvasElement>(null);
  const [muted, setMuted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const grade = lutById(project.gradeId);
  const ratio = frameRatio(project.aspect, media && media.width ? media : null);
  const fit = project.fit ?? "blur";
  const mediaRatio = media && media.width ? media.width / media.height : ratio;
  const needsBlur = fit === "blur" && kind === "video" && Math.abs(mediaRatio - ratio) > 0.01;

  useEffect(() => {
    const box = boxRef.current;
    const frame = frameRef.current;
    if (!box || !frame) return;
    const apply = () => {
      const bounds = box.getBoundingClientRect();
      const width = Math.max(120, bounds.width - 24);
      const height = Math.max(120, bounds.height - 24);
      let frameWidth = width;
      let frameHeight = frameWidth / ratio;
      if (frameHeight > height) {
        frameHeight = height;
        frameWidth = frameHeight * ratio;
      }
      frame.style.width = `${Math.round(frameWidth)}px`;
      frame.style.height = `${Math.round(frameHeight)}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, [ratio]);

  // Clock: follow the video, skip removed segments, run a virtual clock without media.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const state = useStudio.getState();
      const video = mediaBridge.video;
      if (video && mediaBridge.url) {
        if (!video.paused && !video.ended) {
          const cuts = state.project.cuts ?? [];
          const cut = cuts.find((item) => video.currentTime >= item.start && video.currentTime < item.end - 0.03);
          if (cut) seekTo(cut.end);
          state.setPlayhead(video.currentTime);
        }
      } else if (state.playing) {
        const end = projectSpan(state.project.words, state.mediaDuration);
        const next = state.playhead + 1 / 60;
        if (next >= end) {
          state.setPlayhead(end);
          state.setPlaying(false);
        } else state.setPlayhead(next);
      }
      // Blurred fill behind letterboxed video.
      const blur = blurRef.current;
      if (blur && video && video.readyState >= 2 && blur.offsetParent) {
        const ctx = blur.getContext("2d");
        if (ctx) {
          const vw = video.videoWidth || 1;
          const vh = video.videoHeight || 1;
          const s = Math.max(blur.width / vw, blur.height / vh);
          ctx.drawImage(video, (blur.width - vw * s) / 2, (blur.height - vh * s) / 2, vw * s, vh * s);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const video = mediaBridge.video;
    if (!video || !attached) return;
    try {
      ensureVoice(video);
      applyVoice(project.voice);
    } catch {
      /* Web Audio unavailable; plain playback still works */
    }
  }, [project.voice, attached]);

  useEffect(() => {
    if (autoOpen) fileRef.current?.click();
  }, [autoOpen]);

  async function load(file: File) {
    await loadMediaFile(file);
  }

  function toggle() {
    const video = mediaBridge.video;
    if (video && mediaBridge.url) {
      resumeVoice();
      if (video.paused) void video.play();
      else video.pause();
      return;
    }
    const end = projectSpan(project.words, mediaDuration);
    if (playhead >= end - 0.05) useStudio.getState().setPlayhead(0);
    useStudio.getState().setPlaying(!playing);
  }

  const duration = projectSpan(project.words, mediaDuration);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
      <div
        ref={boxRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void load(file);
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.12),transparent_65%)]" />
        <div
          ref={frameRef}
          data-testid="player-stage"
          className={`relative overflow-hidden rounded-xl bg-stage shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] ring-1 ${dragOver ? "ring-2 ring-accent" : "ring-white/10"}`}
        >
          {needsBlur ? <canvas ref={blurRef} width={48} height={Math.round(48 / ratio)} className="absolute inset-0 h-full w-full scale-110 opacity-70 blur-xl" /> : null}
          <video
            ref={(node) => {
              mediaBridge.video = node;
              // A project reopened before the player mounted already has its file — show it.
              if (node && mediaBridge.url && node.getAttribute("src") !== mediaBridge.url) {
                node.src = mediaBridge.url;
                node.load();
              }
            }}
            className={kind === "audio" || !attached ? "sr-only" : `relative h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
            style={{ filter: grade.filter === "none" ? undefined : grade.filter }}
            playsInline
            preload="auto"
            muted={muted}
            onLoadedMetadata={(event) => {
              const value = event.currentTarget.duration;
              if (Number.isFinite(value)) {
                const state = useStudio.getState();
                state.setMedia({ duration: value, kind: state.mediaKind, name: state.project.mediaName });
              }
            }}
            onPlay={() => useStudio.getState().setPlaying(true)}
            onPause={() => useStudio.getState().setPlaying(false)}
            onEnded={() => useStudio.getState().setPlaying(false)}
            onSeeked={(event) => useStudio.getState().setPlayhead(event.currentTarget.currentTime)}
            onSeeking={(event) => useStudio.getState().setPlayhead(event.currentTarget.currentTime)}
            onTimeUpdate={(event) => {
              if (event.currentTarget.paused) useStudio.getState().setPlayhead(event.currentTarget.currentTime);
            }}
          />
          {grade.wash ? (
            <div className="pointer-events-none absolute inset-0" style={{ background: grade.wash, opacity: grade.washOpacity, mixBlendMode: "soft-light" }} />
          ) : null}
          {kind !== "video" || !attached ? <Backdrop audio={kind === "audio" && attached} /> : null}
          {!project.captionsHidden ? (
            <CaptionOverlay words={project.words} time={playhead} look={project.look} keyOnly={project.captionMode === "key"} cuts={project.cuts} />
          ) : null}
          {project.guides ? <div className="pointer-events-none absolute inset-[7%] rounded border border-dashed border-white/40" /> : null}
          {!attached ? (
            <div className="absolute inset-x-4 bottom-5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="shine flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(139,92,246,0.9)]"
              >
                <Upload className="size-4" />
                Upload video
              </button>
              <p className="mt-2 text-center text-[11px] text-white/70">or drop a file anywhere here</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 px-3 py-2">
        <Button tone="ghost" aria-label="Back to start" onClick={() => {
          useStudio.getState().setPlayhead(0);
          seekTo(0);
        }}>
          <RotateCcw className="size-4" />
        </Button>
        <Button tone="primary" aria-label={playing ? "Pause" : "Play"} onClick={toggle} className="w-24">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <span className="rounded-md bg-black/30 px-2 py-1 font-mono text-xs text-muted tabular-nums">
          <span className="text-fg">{formatTime(playhead)}</span> / {formatTime(duration)}
        </span>
        <Button
          tone="ghost"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </Button>
        <Button
          tone="ghost"
          aria-label={project.captionsHidden ? "Show captions" : "Hide captions"}
          title={project.captionsHidden ? "Show captions" : "Hide captions"}
          onClick={() => useStudio.getState().toggleCaptions()}
        >
          {project.captionsHidden ? <CaptionsOff className="size-4" /> : <Captions className="size-4" />}
        </Button>
        <select
          aria-label="Speed"
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
          defaultValue="1"
          onChange={(event) => {
            if (mediaBridge.video) mediaBridge.video.playbackRate = Number(event.target.value);
          }}
        >
          <option value="0.5">0.5×</option>
          <option value="0.75">0.75×</option>
          <option value="1">1×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
        <Button
          tone="ghost"
          aria-label="Full screen preview"
          onClick={() => void frameRef.current?.requestFullscreen?.().catch(() => undefined)}
        >
          <Maximize2 className="size-4" />
        </Button>
        <Button tone="line" className="ml-auto" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          {attached ? "Replace video" : "Upload video"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,audio/*,.mkv,.mov"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void load(file);
            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}

function Backdrop({ audio }: { audio: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(160deg,#1e1b4b_0%,#0f172a_55%,#3b0764_100%)]">
      <div className="aurora opacity-60">
        <span />
        <span />
        <span />
      </div>
      <div className="absolute inset-x-0 top-[14%] flex items-end justify-center gap-1 opacity-80">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            className="wave-bar w-1.5 rounded-full bg-gradient-to-t from-violet-500 to-cyan-300"
            style={{ height: 18 + ((index * 37) % 44), animationDelay: `${(index % 6) * 0.12}s` }}
          />
        ))}
      </div>
      <p className="absolute inset-x-0 top-[34%] text-center text-xs tracking-widest text-white/60 uppercase">
        {audio ? "Audio file — captions render on this background" : "Live caption preview"}
      </p>
    </div>
  );
}
