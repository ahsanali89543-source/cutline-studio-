import { demoProject } from "@/lib/captions/demo";
import { sanitizeWords } from "@/lib/captions/io";
import { saveProject, type ProjectSummary } from "@/lib/captions/projects-db";
import { templateById, templates } from "@/lib/captions/templates";
import type { Aspect, CaptionLook, Cut, FitMode, Project, VoiceMix, Word } from "@/lib/captions/types";
import { defaultVoice } from "@/lib/captions/types";
import { fitWords, lipSyncWords, projectSpan, round, shiftWords, sortWords, tidyWords, uid, wordsFromScript } from "@/lib/captions/timing";
import { create } from "zustand";

const LEGACY_KEYS = ["cutline.projects.v2", "cutline.projects.v1"];

type Snap = { words: Word[]; look: CaptionLook; cuts: Cut[]; splits: number[] };

export type MediaMeta = {
  width: number;
  height: number;
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  frameRate: number | null;
};

export type SaveState = "idle" | "saving" | "saved" | "error";

type StudioState = {
  project: Project;
  /** Whose "My Recent Projects" folder is open (guest, creator:<email> or user:<id>). */
  owner: string | null;
  /** The demo reel shown before any real project exists; it is never saved. */
  isSample: boolean;
  library: ProjectSummary[];
  libraryReady: boolean;
  saveState: SaveState;
  lastSavedAt: number | null;
  playhead: number;
  playing: boolean;
  mediaDuration: number | null;
  mediaKind: "video" | "audio" | null;
  media: MediaMeta | null;
  peaks: number[];
  /** Waveform bars per second of audio. */
  peakRate: number;
  thumbs: string[];
  selectedId: string | null;
  selectedIds: string[];
  selectedSegment: { start: number; end: number } | null;
  language: string;
  busy: string | null;
  progress: number | null;
  note: string | null;
  past: Snap[];
  future: Snap[];
  boot: () => void;
  setOwner: (owner: string) => void;
  setLibrary: (library: ProjectSummary[]) => void;
  upsertSummary: (summary: ProjectSummary) => void;
  dropSummary: (id: string) => void;
  /** Put a project on screen (opened from the folder, new, or the demo). */
  loadIntoStudio: (project: Project, options?: { sample?: boolean; note?: string | null }) => void;
  /** Turn the demo into a real project with its own ID (first real edit or first upload). */
  promoteSample: (patch?: Partial<Project>) => void;
  setProjectThumb: (thumb: string) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setMedia: (patch: { duration: number | null; kind: "video" | "audio" | null; name: string | null }) => void;
  setMediaMeta: (meta: MediaMeta | null) => void;
  setPeaks: (peaks: number[], rate?: number) => void;
  setThumbs: (thumbs: string[]) => void;
  select: (id: string | null, additive?: boolean) => void;
  selectSegment: (segment: { start: number; end: number } | null) => void;
  setLanguage: (language: string) => void;
  setBusy: (busy: string | null, progress?: number | null) => void;
  setNote: (note: string | null) => void;
  rename: (name: string) => void;
  setAspect: (aspect: Aspect) => void;
  setFit: (fit: FitMode) => void;
  setCaptionMode: (mode: "full" | "key") => void;
  toggleCaptions: () => void;
  toggleGuides: () => void;
  applyLook: (look: CaptionLook) => void;
  patchLook: (patch: Partial<CaptionLook>) => void;
  reviseLook: (patch: Partial<CaptionLook>) => void;
  beginGesture: () => void;
  placeWord: (id: string, patch: Partial<Word>) => void;
  placeWords: (patches: Record<string, Partial<Word>>) => void;
  replaceWords: (words: Word[], speakers?: Record<string, string>) => void;
  updateWord: (id: string, patch: Partial<Word>) => void;
  editText: (id: string, text: string) => void;
  removeWord: (id: string) => void;
  removeSelected: () => void;
  splitWord: (id: string) => void;
  joinWord: (id: string) => void;
  addWordAt: (time: number, text?: string) => void;
  nudgeAll: (delta: number) => void;
  fitTo: (duration: number) => void;
  layScript: (text: string, duration: number) => void;
  lipSync: () => void;
  autoKeyWords: () => void;
  tidyTimings: () => void;
  splitAt: (time: number) => void;
  removeRange: (start: number, end: number) => void;
  restoreCut: (id: string) => void;
  clearEdits: () => void;
  applyGrade: (gradeId: string) => void;
  patchVoice: (patch: Partial<VoiceMix>) => void;
  setSpeakerName: (id: string, name: string) => void;
  undo: () => void;
  redo: () => void;
};

// ---------------------------------------------------------------- saving

let saveTimer = 0;
let pending: { owner: string; project: Project } | null = null;

async function writeNow(job: { owner: string; project: Project }) {
  useStudio.setState({ saveState: "saving" });
  try {
    const summary = await saveProject(job.owner, job.project);
    const state = useStudio.getState();
    if (state.owner === job.owner) state.upsertSummary(summary);
    useStudio.setState({ saveState: "saved", lastSavedAt: Date.now() });
  } catch {
    useStudio.setState({ saveState: "error" });
  }
}

function scheduleSave(project: Project) {
  if (typeof window === "undefined") return;
  const state = useStudio.getState();
  if (state.isSample || !state.owner) return;
  // A different project waiting to be written goes out first, so switching never loses edits.
  if (pending && (pending.project.id !== project.id || pending.owner !== state.owner)) void writeNow(pending);
  pending = { owner: state.owner, project };
  window.clearTimeout(saveTimer);
  useStudio.setState({ saveState: "saving" });
  saveTimer = window.setTimeout(() => {
    const job = pending;
    pending = null;
    if (job) void writeNow(job);
  }, 400);
}

/** Write any waiting edit immediately (before switching project or owner). */
export async function flushSave(): Promise<void> {
  if (typeof window !== "undefined") window.clearTimeout(saveTimer);
  const job = pending;
  pending = null;
  if (job) await writeNow(job);
}

/** Save the open project right now (new projects, imports, duplicates). */
export async function saveCurrentNow(): Promise<void> {
  const state = useStudio.getState();
  if (state.isSample || !state.owner) return;
  if (pending?.project.id === state.project.id) {
    await flushSave();
    return;
  }
  await writeNow({ owner: state.owner, project: state.project });
}

function touch(project: Project, patch: Partial<Project>): Project {
  const next = { ...project, ...patch, updatedAt: Date.now() };
  scheduleSave(next);
  return next;
}

/** Projects saved by older versions in one shared localStorage list. */
export function readLegacyProjects(): Project[] {
  if (typeof localStorage === "undefined") return [];
  const out: Project[] = [];
  const seen = new Set<string>();
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Project[];
      if (!Array.isArray(parsed)) continue;
      for (const project of parsed) {
        if (!project || typeof project.id !== "string" || !Array.isArray(project.words) || seen.has(project.id)) continue;
        seen.add(project.id);
        out.push(hydrate(project));
      }
    } catch {
      /* unreadable — skip */
    }
  }
  return out;
}

const lookDefaults = templates.find((item) => item.id === "clean-pop") ?? templates[0];

/** Fill in fields older saves or imported files may lack. */
export function hydrate(project: Project): Project {
  const look = { ...lookDefaults, pro: false, ...(project.look ?? {}) } as CaptionLook;
  const words = Array.isArray(project.words)
    ? sortWords(
        project.words
          .filter((word) => word && typeof word.text === "string" && Number.isFinite(word.start) && Number.isFinite(word.end))
          .map((word) => ({ ...word, id: typeof word.id === "string" && word.id ? word.id : uid() })),
      )
    : [];
  return {
    ...project,
    name: typeof project.name === "string" && project.name.trim() ? project.name : "Untitled reel",
    updatedAt: Number.isFinite(project.updatedAt) ? project.updatedAt : Date.now(),
    aspect: project.aspect ?? "original",
    words,
    speakers: project.speakers ?? {},
    guides: Boolean(project.guides),
    mediaName: project.mediaName ?? null,
    look,
    fit: project.fit ?? "blur",
    gradeId: typeof project.gradeId === "string" ? project.gradeId : "neutral",
    voice: { ...defaultVoice, ...(project.voice ?? {}) },
    captionMode: project.captionMode ?? "full",
    splits: Array.isArray(project.splits) ? project.splits : [],
    cuts: Array.isArray(project.cuts) ? project.cuts : [],
  };
}

export function blankProject(base?: Partial<Project>): Project {
  const now = Date.now();
  return {
    id: uid(),
    name: "Untitled reel",
    updatedAt: now,
    createdAt: now,
    aspect: "original",
    fit: "blur",
    words: [],
    speakers: {},
    look: templateById("roman-classic") ?? templates[0],
    guides: false,
    mediaName: null,
    gradeId: "neutral",
    voice: { ...defaultVoice },
    captionMode: "full",
    splits: [],
    cuts: [],
    duration: null,
    thumb: null,
    ...base,
  };
}

const TRANSIENT = {
  playing: false,
  mediaDuration: null,
  mediaKind: null,
  media: null,
  peaks: [],
  thumbs: [],
  selectedId: null,
  selectedIds: [],
  selectedSegment: null,
  past: [],
  future: [],
} satisfies Partial<StudioState>;

const STOP = new Set(
  "the a an and or to of in on at is are was were be it this that i you we they he she my your our hai hain ka ki ke ko se mein main aur bhi to toh ho tha thi the yeh woh ye wo is us ek na nahi kya jo ab hi par tak liye wala wali wale kar karo raha rahi rahe ga gi ge hum aap tum mera meri mere apna apni apne".split(
    " ",
  ),
);

export const useStudio = create<StudioState>((set, get) => {
  const snapshot = (): Snap => {
    const project = get().project;
    return { words: project.words, look: project.look, cuts: project.cuts ?? [], splits: project.splits ?? [] };
  };
  const commit = (patch: Partial<Pick<Project, "words" | "look" | "cuts" | "splits">>) => {
    // Editing the demo's words makes it a real project with its own ID.
    if (patch.words && get().isSample) get().promoteSample();
    const past = [...get().past, snapshot()].slice(-80);
    const next = patch.words ? { ...patch, words: sortWords(patch.words) } : patch;
    set({ project: touch(get().project, next), past, future: [] });
  };

  return {
    project: demoProject(),
    owner: null,
    isSample: true,
    library: [],
    libraryReady: false,
    saveState: "idle",
    lastSavedAt: null,
    playhead: 0.4,
    playing: false,
    mediaDuration: null,
    mediaKind: null,
    media: null,
    peaks: [],
    peakRate: 40,
    thumbs: [],
    selectedId: null,
    selectedIds: [],
    selectedSegment: null,
    language: "roman-ur",
    busy: null,
    progress: null,
    note: null,
    past: [],
    future: [],
    boot: () => {
      let language = "roman-ur";
      try {
        language = localStorage.getItem("cutline.language") ?? "roman-ur";
      } catch {
        /* ignore */
      }
      set({ language });
    },
    setOwner: (owner) => set({ owner }),
    setLibrary: (library) => set({ library: [...library].sort((a, b) => b.updatedAt - a.updatedAt), libraryReady: true }),
    upsertSummary: (summary) => {
      const rest = get().library.filter((item) => item.id !== summary.id);
      set({ library: [summary, ...rest].sort((a, b) => b.updatedAt - a.updatedAt) });
    },
    dropSummary: (id) => set({ library: get().library.filter((item) => item.id !== id) }),
    loadIntoStudio: (project, options = {}) => {
      set({
        ...TRANSIENT,
        project,
        isSample: Boolean(options.sample),
        playhead: project.words[0]?.start ?? 0,
        note: options.note ?? null,
      });
    },
    promoteSample: (patch = {}) => {
      if (!get().isSample) return;
      const now = Date.now();
      const project: Project = { ...get().project, id: uid(), createdAt: now, updatedAt: now, ...patch };
      set({ isSample: false, project });
      scheduleSave(project);
    },
    setProjectThumb: (thumb) => {
      const project = get().project;
      if (project.thumb === thumb) return;
      set({ project: touch(project, { thumb }) });
    },
    setPlayhead: (time) => set({ playhead: Math.max(0, time) }),
    setPlaying: (playing) => set({ playing }),
    setMedia: ({ duration, kind, name }) => {
      const current = get().project;
      const nextDuration = duration ?? current.duration ?? null;
      const swapped = current.mediaName !== name;
      const changed = swapped || (duration != null && Math.abs((current.duration ?? 0) - duration) > 0.01);
      // A different file means the old poster frame no longer fits.
      const project = changed ? touch(current, swapped ? { mediaName: name, duration: duration ?? null, thumb: null } : { duration: nextDuration }) : current;
      set({ project, mediaDuration: duration, mediaKind: kind });
    },
    setMediaMeta: (media) => set({ media }),
    setPeaks: (peaks, rate) => set({ peaks, peakRate: rate ?? get().peakRate }),
    setThumbs: (thumbs) => set({ thumbs }),
    select: (id, additive) => {
      if (!id) {
        set({ selectedId: null, selectedIds: [] });
        return;
      }
      if (additive) {
        const ids = get().selectedIds.includes(id)
          ? get().selectedIds.filter((item) => item !== id)
          : [...get().selectedIds, id];
        set({ selectedId: id, selectedIds: ids, selectedSegment: null });
        return;
      }
      set({ selectedId: id, selectedIds: [id], selectedSegment: null });
    },
    selectSegment: (segment) => set({ selectedSegment: segment, selectedId: null, selectedIds: [] }),
    setLanguage: (language) => {
      try {
        localStorage.setItem("cutline.language", language);
      } catch {
        /* ignore */
      }
      set({ language });
    },
    setBusy: (busy, progress = null) => set({ busy, progress: busy ? progress : null }),
    setNote: (note) => set({ note }),
    rename: (name) => set({ project: touch(get().project, { name }) }),
    setAspect: (aspect) => set({ project: touch(get().project, { aspect }) }),
    setFit: (fit) => set({ project: touch(get().project, { fit }) }),
    setCaptionMode: (captionMode) => set({ project: touch(get().project, { captionMode }) }),
    toggleCaptions: () => set({ project: touch(get().project, { captionsHidden: !get().project.captionsHidden }) }),
    toggleGuides: () => set({ project: touch(get().project, { guides: !get().project.guides }) }),
    applyLook: (look) => commit({ look: { ...look } }),
    patchLook: (patch) => {
      const current = get().project.look;
      commit({ look: { ...current, ...patch, id: current.id.startsWith("custom") ? current.id : `custom-${current.id}`, name: current.name.endsWith("(edited)") ? current.name : `${current.name} (edited)` } });
    },
    reviseLook: (patch) => {
      const current = get().project.look;
      const look = {
        ...current,
        ...patch,
        id: current.id.startsWith("custom") ? current.id : `custom-${current.id}`,
        name: current.name.endsWith("(edited)") ? current.name : `${current.name} (edited)`,
      };
      set({ project: touch(get().project, { look }) });
    },
    beginGesture: () => {
      set({ past: [...get().past, snapshot()].slice(-80), future: [] });
    },
    placeWord: (id, patch) => {
      const words = sortWords(get().project.words.map((word) => (word.id === id ? { ...word, ...patch } : word)));
      set({ project: touch(get().project, { words }) });
    },
    placeWords: (patches) => {
      const words = get()
        .project.words.map((word) => (patches[word.id] ? { ...word, ...patches[word.id] } : word))
        .sort((a, b) => a.start - b.start);
      set({ project: touch(get().project, { words }) });
    },
    replaceWords: (incoming, speakers) => {
      if (get().isSample) get().promoteSample();
      const words = sortWords(incoming);
      const named = { ...get().project.speakers };
      if (speakers) Object.assign(named, speakers);
      const past = [...get().past, snapshot()].slice(-80);
      set({
        project: touch(get().project, { words, speakers: named }),
        past,
        future: [],
        selectedId: null,
        selectedIds: [],
        playhead: words[0]?.start ?? 0,
      });
    },
    updateWord: (id, patch) => {
      const words = get()
        .project.words.map((word) => (word.id === id ? { ...word, ...patch } : word))
        .sort((a, b) => a.start - b.start);
      commit({ words });
    },
    editText: (id, text) => {
      const cleaned = text.replace(/\s+/g, " ").trim();
      if (!cleaned) {
        get().removeWord(id);
        return;
      }
      get().updateWord(id, { text: cleaned });
    },
    removeWord: (id) => {
      commit({ words: get().project.words.filter((word) => word.id !== id) });
      if (get().selectedId === id) set({ selectedId: null, selectedIds: [] });
    },
    removeSelected: () => {
      const { selectedIds, selectedSegment } = get();
      if (selectedSegment) {
        get().removeRange(selectedSegment.start, selectedSegment.end);
        set({ selectedSegment: null });
        return;
      }
      if (!selectedIds.length) return;
      const drop = new Set(selectedIds);
      commit({ words: get().project.words.filter((word) => !drop.has(word.id)) });
      set({ selectedId: null, selectedIds: [] });
    },
    splitWord: (id) => {
      const words = get().project.words;
      const index = words.findIndex((word) => word.id === id);
      if (index < 0) return;
      const word = words[index];
      const parts = word.text.split(/\s+/).filter(Boolean);
      const mid = Math.max(word.start + 0.04, (word.start + word.end) / 2);
      let left = word.text;
      let right = word.text;
      if (parts.length > 1) {
        const cut = Math.ceil(parts.length / 2);
        left = parts.slice(0, cut).join(" ");
        right = parts.slice(cut).join(" ");
      } else if (word.text.length > 2) {
        const cut = Math.ceil(word.text.length / 2);
        left = word.text.slice(0, cut);
        right = word.text.slice(cut);
      }
      const next = [...words];
      next.splice(index, 1, { ...word, text: left, end: round(mid) }, { ...word, id: uid(), text: right, start: round(mid), emphasis: false });
      commit({ words: next });
    },
    joinWord: (id) => {
      const words = get().project.words;
      const index = words.findIndex((word) => word.id === id);
      if (index < 0 || index === words.length - 1) return;
      const word = words[index];
      const nextWord = words[index + 1];
      const next = [...words];
      next.splice(index, 2, { ...word, text: `${word.text} ${nextWord.text}`.trim(), end: nextWord.end, breakAfter: nextWord.breakAfter });
      commit({ words: next });
    },
    addWordAt: (time, text = "word") => {
      const word: Word = { id: uid(), text, start: round(time), end: round(time + 0.4) };
      commit({ words: [...get().project.words, word].sort((a, b) => a.start - b.start) });
      set({ selectedId: word.id, selectedIds: [word.id] });
    },
    nudgeAll: (delta) => commit({ words: shiftWords(get().project.words, delta) }),
    fitTo: (duration) => commit({ words: fitWords(get().project.words, duration) }),
    layScript: (text, duration) => {
      const words = wordsFromScript(text, duration);
      get().replaceWords(words);
      const span = get().mediaDuration || duration;
      commit({ words: lipSyncWords(get().project.words, get().peaks, span) });
      set({
        note: get().peaks.length
          ? "Script locked to the voice. Drag any word on the timeline that leads or lags the mouth."
          : "Script placed by word weight. Add the video so lip-sync can lock onto speech.",
      });
    },
    lipSync: () => {
      const duration = get().mediaDuration || projectSpan(get().project.words, null);
      commit({ words: lipSyncWords(get().project.words, get().peaks, duration) });
    },
    autoKeyWords: () => {
      const words = get().project.words;
      const scored = words.map((word, index) => {
        const bare = word.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
        let score = bare.length;
        if (STOP.has(bare)) score -= 10;
        if (/\d/.test(bare)) score += 4;
        if (/[!?]$/.test(word.text)) score += 3;
        if (word.text === word.text.toUpperCase() && bare.length > 2) score += 3;
        return { index, score };
      });
      const target = Math.max(1, Math.round(words.length / 6));
      const keep = new Set(
        [...scored]
          .sort((a, b) => b.score - a.score)
          .slice(0, target)
          .filter((item) => item.score > 3)
          .map((item) => item.index),
      );
      commit({ words: words.map((word, index) => ({ ...word, emphasis: keep.has(index) })) });
    },
    tidyTimings: () => {
      const words = get().project.words;
      const tidy = tidyWords(words);
      const changed = tidy.length !== words.length || tidy.some((word, index) => word.start !== words[index]?.start || word.end !== words[index]?.end);
      if (!changed) {
        set({ note: "Timings are already clean — no overlapping words." });
        return;
      }
      commit({ words: tidy });
      set({ note: `Cleaned the timeline: ${words.length - tidy.length ? `${words.length - tidy.length} duplicate word(s) removed, ` : ""}overlaps trimmed so every word sits on one lane.` });
    },
    splitAt: (time) => {
      const splits = get().project.splits ?? [];
      const t = round(time);
      if (splits.some((item) => Math.abs(item - t) < 0.05)) return;
      commit({ splits: [...splits, t].sort((a, b) => a - b) });
    },
    removeRange: (start, end) => {
      const a = round(Math.max(0, Math.min(start, end)));
      const b = round(Math.max(a + 0.05, Math.max(start, end)));
      const cuts = [...(get().project.cuts ?? []), { id: uid(), start: a, end: b }];
      commit({ cuts: mergeCuts(cuts) });
    },
    restoreCut: (id) => commit({ cuts: (get().project.cuts ?? []).filter((cut) => cut.id !== id) }),
    clearEdits: () => commit({ cuts: [], splits: [] }),
    applyGrade: (gradeId) => set({ project: touch(get().project, { gradeId }) }),
    patchVoice: (patch) => set({ project: touch(get().project, { voice: { ...get().project.voice, ...patch } }) }),
    setSpeakerName: (id, name) => set({ project: touch(get().project, { speakers: { ...get().project.speakers, [id]: name } }) }),
    undo: () => {
      const { past, future, project } = get();
      const snap = past[past.length - 1];
      if (!snap) return;
      set({
        project: touch(project, snap),
        past: past.slice(0, -1),
        future: [...future, snapshot()],
      });
    },
    redo: () => {
      const { past, future, project } = get();
      const snap = future[future.length - 1];
      if (!snap) return;
      set({
        project: touch(project, snap),
        future: future.slice(0, -1),
        past: [...past, snapshot()],
      });
    },
  };
});

function mergeCuts(cuts: Cut[]): Cut[] {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const out: Cut[] = [];
  for (const cut of sorted) {
    const last = out[out.length - 1];
    if (last && cut.start <= last.end + 0.01) last.end = Math.max(last.end, cut.end);
    else out.push({ ...cut });
  }
  return out;
}

/** Segments of the source between split points, flagged when removed. */
export function segmentsOf(duration: number, splits: number[], cuts: Cut[]) {
  const points = [0, ...splits.filter((item) => item > 0.01 && item < duration - 0.01), duration];
  const out: { start: number; end: number; removed: boolean; cutId?: string }[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const mid = (start + end) / 2;
    const cut = cuts.find((item) => mid >= item.start && mid <= item.end);
    out.push({ start, end, removed: Boolean(cut), cutId: cut?.id });
  }
  return out;
}

/** Kept ranges of the source after cuts. */
export function keptRanges(duration: number, cuts: Cut[]): { start: number; end: number }[] {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const cut of sorted) {
    if (cut.start > cursor + 0.01) out.push({ start: cursor, end: Math.min(cut.start, duration) });
    cursor = Math.max(cursor, cut.end);
  }
  if (cursor < duration - 0.01) out.push({ start: cursor, end: duration });
  return out.filter((range) => range.end - range.start > 0.01);
}

export function applyIncomingWords(raw: unknown[], durationHint?: number) {
  let words = sanitizeWords(raw);
  if (durationHint && words.length) {
    const max = Math.max(...words.map((word) => word.end));
    if (max > durationHint * 8 && max > 30) {
      words = words.map((word) => ({ ...word, start: round(word.start / 1000), end: round(word.end / 1000) }));
    }
  }
  words = tidyWords(words);
  const speakers: Record<string, string> = {};
  for (const word of words) {
    if (word.speaker == null) continue;
    const key = String(word.speaker);
    if (!speakers[key]) speakers[key] = `Speaker ${word.speaker + 1}`;
  }
  useStudio.getState().replaceWords(words, speakers);
}

export function applyTemplateFromSearch(id: string | undefined) {
  const look = templateById(id);
  if (!look) return;
  useStudio.getState().applyLook(look);
}
