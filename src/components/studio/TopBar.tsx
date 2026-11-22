import { AccountSlot } from "@/components/site/Shell";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { parseTranscript } from "@/lib/captions/io";
import { useStudio } from "@/lib/captions/store";
import { projectSpan, tidyWords } from "@/lib/captions/timing";
import { ASPECTS, LANGUAGES, type Aspect, type FitMode } from "@/lib/captions/types";
import { Check, CloudOff, Download, FileUp, FolderOpen, Grid3x3, Loader2, MoreHorizontal, Save, Sparkles, Wand2 } from "lucide-react";
import { exportProjectFile } from "@/lib/captions/projects";
import { useRef, useState } from "react";

export function TopBar({ onTranscribe, onExport, onProjects }: { onTranscribe: () => void; onExport: () => void; onProjects: () => void }) {
  const project = useStudio((state) => state.project);
  const library = useStudio((state) => state.library);
  const language = useStudio((state) => state.language);
  const busy = useStudio((state) => state.busy);
  const [menu, setMenu] = useState<"more" | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [script, setScript] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const select = "h-9 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent";

  async function onImport(file: File) {
    const text = await file.text();
    try {
      const words = tidyWords(parseTranscript(text));
      if (!words.length) {
        useStudio.getState().setNote("That file had no cues. Use SRT, VTT or JSON.");
        return;
      }
      useStudio.getState().replaceWords(words);
      useStudio.getState().setNote(`Imported ${words.length} words from ${file.name}.`);
    } catch {
      useStudio.getState().setNote("Could not read that transcript file.");
    }
  }

  return (
    <header className="z-30 flex w-full max-w-full flex-wrap items-center gap-2 border-b border-white/5 bg-bg/80 px-3 py-2 backdrop-blur-xl">
      <Logo compact />
      <input
        aria-label="Project name"
        value={project.name}
        onChange={(event) => useStudio.getState().rename(event.target.value)}
        className="h-9 w-32 min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-sm font-semibold outline-none hover:border-line focus:border-accent sm:w-44"
      />
      <SaveBadge />
      <Button tone="line" size="sm" onClick={onProjects} title="My Recent Projects" data-testid="open-projects">
        <FolderOpen className="size-4" />
        <span className="hidden sm:inline">My Projects</span>
        {library.length ? <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-muted">{library.length}</span> : null}
      </Button>
      <select aria-label="Frame" className={`${select} max-w-36`} value={project.aspect} onChange={(event) => useStudio.getState().setAspect(event.target.value as Aspect)}>
        {(Object.keys(ASPECTS) as Aspect[]).map((aspect) => (
          <option key={aspect} value={aspect}>
            {aspect === "original" ? "Original size" : `${aspect} ${ASPECTS[aspect].label}`}
          </option>
        ))}
      </select>
      <select aria-label="Fit" className={`${select} hidden md:block`} value={project.fit ?? "blur"} onChange={(event) => useStudio.getState().setFit(event.target.value as FitMode)}>
        <option value="blur">Fit + blur fill</option>
        <option value="contain">Fit (black bars)</option>
        <option value="cover">Fill / crop</option>
      </select>
      <Button tone="ghost" size="sm" className="hidden md:inline-flex" title="Safe-area guides" onClick={() => useStudio.getState().toggleGuides()}>
        <Grid3x3 className={`size-4 ${project.guides ? "text-accent-2" : ""}`} />
      </Button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select aria-label="Language" className={`${select} hidden max-w-40 sm:block`} value={language} onChange={(event) => useStudio.getState().setLanguage(event.target.value)}>
          {LANGUAGES.map((item) => (
            <option key={item.id || "auto"} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <Button tone="hot" size="sm" disabled={Boolean(busy)} onClick={onTranscribe} data-testid="open-transcribe" className="min-w-32">
          <Sparkles className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Working…" : "Transcribe"}
        </Button>
        <div className="relative">
          <Button tone="ghost" size="sm" onClick={() => setMenu(menu === "more" ? null : "more")} aria-label="More tools">
            <MoreHorizontal className="size-4" />
          </Button>
          {menu === "more" ? (
            <div className="absolute right-0 z-40 mt-1 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
              <MenuItem
                icon={<FileUp className="size-4" />}
                label="Paste a script"
                onClick={() => {
                  setScriptOpen(true);
                  setMenu(null);
                }}
              />
              <MenuItem
                icon={<FileUp className="size-4" />}
                label="Import SRT / VTT / JSON"
                onClick={() => {
                  importRef.current?.click();
                  setMenu(null);
                }}
              />
              <MenuItem
                icon={<Save className="size-4" />}
                label="Download project file (.cutline)"
                onClick={() => {
                  void exportProjectFile();
                  setMenu(null);
                }}
              />
              <MenuItem
                icon={<Wand2 className="size-4" />}
                label="Lip-sync words to voice"
                onClick={() => {
                  useStudio.getState().lipSync();
                  useStudio.getState().setNote("Words pulled onto the voice. Drag any late word on the timeline.");
                  setMenu(null);
                }}
              />
              <MenuItem
                icon={<Wand2 className="size-4" />}
                label="Fit words to media length"
                onClick={() => {
                  const duration = useStudio.getState().mediaDuration;
                  if (duration) useStudio.getState().fitTo(duration);
                  else useStudio.getState().setNote("Add media before fitting timings.");
                  setMenu(null);
                }}
              />
            </div>
          ) : null}
        </div>
        <Button tone="primary" size="sm" onClick={onExport} data-testid="open-export" className="min-w-28">
          <Download className="size-4" /> Export
        </Button>
        <AccountSlot compact />
      </div>
      <input
        ref={importRef}
        type="file"
        accept=".srt,.vtt,.json,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onImport(file);
          event.target.value = "";
        }}
      />
      {scriptOpen ? (
        <form
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            const state = useStudio.getState();
            const duration = projectSpan(state.project.words, state.mediaDuration);
            const span = state.mediaDuration || Math.max(duration, script.trim().split(/\s+/).length * 0.32);
            state.layScript(script, span);
            setScriptOpen(false);
            setScript("");
          }}
        >
          <div className="gradient-border w-full max-w-lg rounded-2xl p-5">
            <h2 className="font-display text-2xl font-extrabold">Paste a script</h2>
            <p className="mt-1 text-sm text-muted">Words follow the voice energy when a video is loaded; then drag any word on the timeline.</p>
            <textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              className="mt-3 h-44 w-full rounded-lg border border-line bg-black/30 p-3 text-sm outline-none focus:border-accent"
              placeholder="Assalam o alaikum dosto, aaj hum…"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" tone="ghost" onClick={() => setScriptOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" tone="primary" size="md">
                Place on timeline
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </header>
  );
}

function SaveBadge() {
  const saveState = useStudio((state) => state.saveState);
  const isSample = useStudio((state) => state.isSample);
  if (isSample) {
    return (
      <span className="hidden items-center gap-1 text-[11px] text-muted md:inline-flex" title="The demo is not saved. Upload a video to start your own project.">
        Demo · not saved
      </span>
    );
  }
  if (saveState === "saving") {
    return (
      <span className="hidden items-center gap-1 text-[11px] text-muted md:inline-flex" data-testid="save-state">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (saveState === "error") {
    return (
      <span className="hidden items-center gap-1 text-[11px] text-rose-300 md:inline-flex" data-testid="save-state" title="This browser blocked saving. Download the project file to keep it.">
        <CloudOff className="size-3" /> Not saved
      </span>
    );
  }
  if (saveState === "saved") {
    return (
      <span className="hidden items-center gap-1 text-[11px] text-emerald-300/90 md:inline-flex" data-testid="save-state">
        <Check className="size-3" /> Saved
      </span>
    );
  }
  return null;
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/5">
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  );
}
