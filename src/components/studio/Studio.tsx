import { ExportDialog } from "@/components/studio/ExportDialog";
import { Inspector } from "@/components/studio/Inspector";
import { Player } from "@/components/studio/Player";
import { ProjectsDialog } from "@/components/studio/ProjectsDialog";
import { Timeline } from "@/components/studio/Timeline";
import { TopBar } from "@/components/studio/TopBar";
import { TranscribeDialog } from "@/components/studio/TranscribeDialog";
import { TranscriptPanel } from "@/components/studio/TranscriptPanel";
import { useAccount } from "@/lib/account";
import { mediaBridge, seekTo } from "@/lib/captions/media";
import { bootLibrary, switchOwner, useProjectOwner } from "@/lib/captions/projects";
import { flushSave, useStudio } from "@/lib/captions/store";
import { templateById } from "@/lib/captions/templates";
import { useEffect, useRef, useState } from "react";

const HEIGHT_KEY = "cutline.timeline.height";

export function Studio({
  template,
  grade,
  autoOpen = false,
  openProjects = false,
}: {
  template?: string;
  grade?: string;
  autoOpen?: boolean;
  openProjects?: boolean;
}) {
  const [pane, setPane] = useState<"picture" | "words" | "look" | "timeline">("picture");
  const [ready, setReady] = useState(false);
  const [transcribeOpen, setTranscribeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(openProjects);
  const owner = useProjectOwner();
  const booted = useRef(false);
  const [timelineH, setTimelineH] = useState(300);
  const dragRef = useRef<{ y: number; h: number } | null>(null);

  useEffect(() => {
    useStudio.getState().boot();
    useAccount.getState().hydrate();
    try {
      const saved = Number(localStorage.getItem(HEIGHT_KEY));
      if (saved >= 180 && saved <= 700) setTimelineH(saved);
    } catch {
      /* ignore */
    }
  }, []);

  // Open this user's "My Recent Projects" folder once we know who they are,
  // and switch folders when they sign in or out.
  useEffect(() => {
    if (!owner) return;
    if (booted.current) {
      void switchOwner(owner);
      return;
    }
    booted.current = true;
    void bootLibrary(owner).finally(() => {
      if (template) {
        const look = templateById(template);
        if (look) {
          const member = Boolean(useAccount.getState().creator);
          if (look.pro && !member) useAccount.getState().openLogin(`${look.name} is PRO — unlock it free`, () => useStudio.getState().applyLook(look));
          else useStudio.getState().applyLook(look);
        }
      }
      if (grade) useStudio.getState().applyGrade(grade);
      setReady(true);
    });
  }, [owner, template, grade]);

  // Never lose the last half-second of edits when the tab closes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushSave();
    };
    const onUnload = () => void flushSave();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
      void flushSave();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const state = useStudio.getState();
      if (event.key === " ") {
        event.preventDefault();
        const video = mediaBridge.video;
        if (video && mediaBridge.url) {
          if (video.paused) void video.play();
          else video.pause();
        } else state.setPlaying(!state.playing);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 1 / 30;
        const time = Math.max(0, state.playhead + (event.key === "ArrowLeft" ? -step : step));
        state.setPlayhead(time);
        seekTo(time);
      }
      if ((event.key === "i" || event.key === "o") && state.selectedId) {
        const word = state.project.words.find((item) => item.id === state.selectedId);
        if (!word) return;
        if (event.key === "i") state.updateWord(word.id, { start: Math.min(state.playhead, word.end - 0.04) });
        if (event.key === "o") state.updateWord(word.id, { end: Math.max(state.playhead, word.start + 0.04) });
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
      }
      if (event.key === "Delete" || event.key === "Backspace") state.removeSelected();
      if (event.key === "Escape") state.select(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg text-fg">
        <p className="font-display text-4xl font-extrabold">
          Cutline<span className="text-gradient"> Studio</span>
        </p>
      </main>
    );
  }

  return (
    <main className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-bg text-fg">
      <TopBar onTranscribe={() => setTranscribeOpen(true)} onExport={() => setExportOpen(true)} onProjects={() => setProjectsOpen(true)} />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`grid min-h-0 w-full min-w-0 flex-1 lg:grid-cols-[minmax(240px,22%)_1fr_minmax(300px,26%)] ${pane === "timeline" ? "max-lg:min-h-[30dvh]" : ""}`}>
          <div className={`h-full min-h-0 min-w-0 ${pane !== "words" ? "max-lg:hidden" : ""}`}>
            <TranscriptPanel />
          </div>
          <div className={`h-full min-h-0 min-w-0 ${pane !== "picture" && pane !== "timeline" ? "max-lg:hidden" : ""}`}>
            <Player autoOpen={autoOpen} />
          </div>
          <div className={`h-full min-h-0 min-w-0 ${pane !== "look" ? "max-lg:hidden" : ""}`}>
            <Inspector />
          </div>
        </div>
        <div className={`relative shrink-0 max-lg:!h-[64dvh] ${pane !== "timeline" ? "max-lg:hidden" : ""}`} style={{ height: timelineH }}>
          <div
            className="absolute -top-1.5 right-0 left-0 z-30 h-3 cursor-ns-resize max-lg:hidden"
            title="Drag to resize the timeline"
            onPointerDown={(event) => {
              dragRef.current = { y: event.clientY, h: timelineH };
              const move = (ev: PointerEvent) => {
                if (!dragRef.current) return;
                const next = Math.min(Math.round(window.innerHeight * 0.7), Math.max(180, dragRef.current.h + (dragRef.current.y - ev.clientY)));
                setTimelineH(next);
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                dragRef.current = null;
                setTimelineH((value) => {
                  try {
                    localStorage.setItem(HEIGHT_KEY, String(value));
                  } catch {
                    /* ignore */
                  }
                  return value;
                });
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <div className="mx-auto mt-1 h-1 w-14 rounded-full bg-white/15 hover:bg-accent" />
          </div>
          <Timeline />
        </div>
      </div>
      <nav className="grid grid-cols-4 border-t border-white/5 bg-surface lg:hidden">
        {(
          [
            ["picture", "Preview"],
            ["words", "Words"],
            ["look", "Style"],
            ["timeline", "Timeline"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setPane(id)} className={`h-12 text-sm ${pane === id ? "font-semibold text-fg" : "text-muted"}`}>
            {label}
            {pane === id ? <span className="mx-auto mt-1 block h-0.5 w-8 rounded-full bg-brand" /> : null}
          </button>
        ))}
      </nav>
      <TranscribeDialog open={transcribeOpen} onClose={() => setTranscribeOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ProjectsDialog open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </main>
  );
}
