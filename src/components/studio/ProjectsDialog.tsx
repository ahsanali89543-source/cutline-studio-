import { Button } from "@/components/ui/button";
import { useMemberName } from "@/lib/account";
import {
  createNewProject,
  deleteSavedProject,
  duplicateSavedProject,
  exportProjectFile,
  importProjectFile,
  openSavedProject,
  refreshLibrary,
  renameSavedProject,
} from "@/lib/captions/projects";
import { GUEST_OWNER, RECENT_FOLDER, storageUsage, type ProjectSummary } from "@/lib/captions/projects-db";
import { useStudio } from "@/lib/captions/store";
import { formatTime } from "@/lib/captions/timing";
import { Copy, Download, Film, FolderOpen, HardDrive, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function ago(time: number) {
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function bytes(value: number | null | undefined) {
  if (!value) return "";
  if (value > 1073741824) return `${(value / 1073741824).toFixed(1)} GB`;
  return `${Math.max(0.1, value / 1048576).toFixed(1)} MB`;
}

export function ProjectsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const library = useStudio((state) => state.library);
  const currentId = useStudio((state) => state.project.id);
  const owner = useStudio((state) => state.owner);
  const isSample = useStudio((state) => state.isSample);
  const memberName = useMemberName();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    void refreshLibrary();
    void storageUsage().then(setUsage);
    setConfirming(null);
    setRenaming(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return library;
    return library.filter((item) => item.name.toLowerCase().includes(needle) || (item.mediaName ?? "").toLowerCase().includes(needle) || item.id.startsWith(needle));
  }, [library, query]);

  if (!open) return null;

  const folderOwner = owner === GUEST_OWNER || !owner ? "Guest (this device)" : (memberName ?? owner.replace(/^(creator|user):/, ""));

  async function run(label: string, job: () => Promise<void>, close = false) {
    setBusy(label);
    try {
      await job();
      if (close) onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={RECENT_FOLDER}
      data-testid="projects-dialog"
    >
      <div className="gradient-border fade-up relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex flex-wrap items-start gap-3 border-b border-white/5 p-5 pb-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <FolderOpen className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-extrabold">{RECENT_FOLDER}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {folderOwner} · {library.length} project{library.length === 1 ? "" : "s"} · each saved under its own ID, with its video
            </p>
          </div>
          <Button tone="ghost" size="xs" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <Button tone="primary" size="sm" disabled={Boolean(busy)} onClick={() => void run("new", createNewProject, true)} data-testid="new-project">
            <Plus className="size-4" /> New project
          </Button>
          <Button tone="line" size="sm" disabled={Boolean(busy)} onClick={() => importRef.current?.click()}>
            <Upload className="size-4" /> Open .cutline file
          </Button>
          <label className="relative ml-auto flex min-w-48 flex-1 items-center sm:max-w-64">
            <Search className="pointer-events-none absolute left-2.5 size-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="h-9 w-full rounded-lg border border-line bg-black/20 pr-2 pl-8 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {isSample ? (
            <p className="mb-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-muted">
              You are looking at the demo reel. Upload a video (or transcribe / edit words) and it becomes a new project in this folder automatically.
            </p>
          ) : null}
          {!shown.length ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-14 text-center">
              <Film className="size-8 text-muted" />
              <p className="mt-3 text-sm font-medium">{library.length ? "No project matches that search." : "No projects yet"}</p>
              <p className="mt-1 max-w-sm text-xs text-muted">
                {library.length ? "Try another name." : "Upload a video in the studio — it is saved here under its own ID, and you can reopen it any time."}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="projects-list">
              {shown.map((item) => (
                <ProjectCard
                  key={item.id}
                  item={item}
                  current={item.id === currentId && !isSample}
                  renaming={renaming === item.id}
                  confirming={confirming === item.id}
                  disabled={Boolean(busy)}
                  onOpen={() => void run(`open-${item.id}`, () => openSavedProject(item.id), true)}
                  onRename={() => setRenaming(item.id)}
                  onRenameDone={(name) => {
                    setRenaming(null);
                    if (name && name !== item.name) void renameSavedProject(item.id, name);
                  }}
                  onDuplicate={() => void run(`dup-${item.id}`, () => duplicateSavedProject(item.id))}
                  onDownload={() => void exportProjectFile(item.id)}
                  onDelete={() => {
                    if (confirming !== item.id) {
                      setConfirming(item.id);
                      return;
                    }
                    setConfirming(null);
                    void run(`del-${item.id}`, () => deleteSavedProject(item.id));
                  }}
                  onCancelDelete={() => setConfirming(null)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-5 py-3 text-[11px] text-muted">
          <HardDrive className="size-3.5" />
          <span>
            Saved in this browser{usage?.quota ? ` · ${bytes(usage.usage)} used of ${bytes(usage.quota)}` : ""}. Use “Download” to keep a .cutline copy or move a project to another computer.
          </span>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".cutline,application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void run("import", () => importProjectFile(file), true);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function ProjectCard({
  item,
  current,
  renaming,
  confirming,
  disabled,
  onOpen,
  onRename,
  onRenameDone,
  onDuplicate,
  onDownload,
  onDelete,
  onCancelDelete,
}: {
  item: ProjectSummary;
  current: boolean;
  renaming: boolean;
  confirming: boolean;
  disabled: boolean;
  onOpen: () => void;
  onRename: () => void;
  onRenameDone: (name: string) => void;
  onDuplicate: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <li
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white/[0.02] transition-colors ${current ? "border-accent/70" : "border-white/8 hover:border-white/20"}`}
      data-testid="project-card"
      data-project-id={item.id}
    >
      <button type="button" disabled={disabled} onClick={onOpen} className="relative aspect-video w-full overflow-hidden bg-[linear-gradient(135deg,#1e1b4b,#0e7490)] text-left" title={`Open ${item.name}`}>
        {item.thumb ? <img src={item.thumb} alt="" className="h-full w-full object-contain" draggable={false} /> : <Film className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-white/40" />}
        {item.duration ? <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{formatTime(item.duration)}</span> : null}
        {current ? <span className="absolute top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Open now</span> : null}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {renaming ? (
          <input
            autoFocus
            defaultValue={item.name}
            className="h-8 rounded-md border border-accent bg-black/40 px-2 text-sm font-semibold outline-none"
            onBlur={(event) => onRenameDone(event.currentTarget.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") onRenameDone(item.name);
            }}
          />
        ) : (
          <button type="button" disabled={disabled} onClick={onOpen} className="truncate text-left text-sm font-semibold hover:text-accent-2" title={item.name}>
            {item.name}
          </button>
        )}
        <p className="truncate text-[11px] text-muted" title={item.mediaName ?? undefined}>
          {item.wordCount} words · {item.hasMedia ? `video saved${item.mediaSize ? ` (${bytes(item.mediaSize)})` : ""}` : item.mediaName ? "video not on this device" : "no video yet"}
        </p>
        <p className="font-mono text-[10px] text-muted/80" title={item.id}>
          ID {item.id.slice(0, 8)} · edited {ago(item.updatedAt)}
        </p>
        {confirming ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/10 p-1.5">
            <span className="flex-1 pl-1 text-[11px] text-rose-200">Delete project and its video?</span>
            <Button tone="ghost" size="xs" onClick={onCancelDelete}>
              Keep
            </Button>
            <Button tone="hot" size="xs" onClick={onDelete} data-testid="confirm-delete">
              Delete
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1">
            <Button tone="quiet" size="xs" disabled={disabled} onClick={onOpen} className="flex-1">
              <FolderOpen className="size-3.5" /> Open
            </Button>
            <Button tone="ghost" size="xs" disabled={disabled} onClick={onRename} title="Rename" aria-label="Rename">
              <Pencil className="size-3.5" />
            </Button>
            <Button tone="ghost" size="xs" disabled={disabled} onClick={onDuplicate} title="Duplicate (new ID)" aria-label="Duplicate">
              <Copy className="size-3.5" />
            </Button>
            <Button tone="ghost" size="xs" disabled={disabled} onClick={onDownload} title="Download .cutline project file" aria-label="Download project file">
              <Download className="size-3.5" />
            </Button>
            <Button tone="ghost" size="xs" disabled={disabled} onClick={onDelete} title="Delete" aria-label="Delete" className="hover:text-rose-300">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
