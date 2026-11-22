/**
 * "My Recent Projects" storage — one folder per user on this device.
 *
 * Every project is saved under its own ID inside its owner's folder
 * (`<owner>::<projectId>`), so two accounts on one browser never see each
 * other's work. The attached video/audio file is kept next to the project, so
 * reopening a recent project brings the picture back too.
 *
 * IndexedDB holds everything (it has room for video files). If IndexedDB is
 * blocked (some private windows), projects fall back to localStorage without
 * their media.
 */
import type { Project } from "@/lib/captions/types";

export const GUEST_OWNER = "guest";
export const RECENT_FOLDER = "My Recent Projects";

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  duration: number | null;
  wordCount: number;
  mediaName: string | null;
  hasMedia: boolean;
  mediaSize: number | null;
  thumb: string | null;
};

type ProjectRecord = ProjectSummary & { key: string; owner: string; project: Project };

type MediaRecord = {
  key: string;
  owner: string;
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

const DB_NAME = "cutline-studio";
const DB_VERSION = 1;
const PROJECTS = "projects";
const MEDIA = "media";
const FALLBACK_PREFIX = "cutline.projects.v3.";

const keyOf = (owner: string, id: string) => `${owner}::${id}`;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) {
        const store = db.createObjectStore(PROJECTS, { keyPath: "key" });
        store.createIndex("owner", "owner", { unique: false });
      }
      if (!db.objectStoreNames.contains(MEDIA)) {
        const store = db.createObjectStore(MEDIA, { keyPath: "key" });
        store.createIndex("owner", "owner", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Storage request failed"));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Storage transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Storage transaction aborted"));
  });
}

// ---------------------------------------------------------------- fallback

function readFallback(owner: string): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(FALLBACK_PREFIX + owner);
    const list = raw ? (JSON.parse(raw) as ProjectRecord[]) : [];
    return Array.isArray(list) ? list.filter((item) => item && item.project && typeof item.id === "string") : [];
  } catch {
    return [];
  }
}

function writeFallback(owner: string, list: ProjectRecord[]) {
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  // localStorage is small: drop the oldest projects until the folder fits.
  for (let keep = sorted.length; keep >= 1; keep -= 1) {
    try {
      localStorage.setItem(FALLBACK_PREFIX + owner, JSON.stringify(sorted.slice(0, keep)));
      return;
    } catch {
      /* too big — try with one project fewer */
    }
  }
}

// ---------------------------------------------------------------- helpers

function summaryOf(record: ProjectRecord): ProjectSummary {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    duration: record.duration,
    wordCount: record.wordCount,
    mediaName: record.mediaName,
    hasMedia: record.hasMedia,
    mediaSize: record.mediaSize,
    thumb: record.thumb,
  };
}

function recordFor(owner: string, project: Project, previous: ProjectRecord | null): ProjectRecord {
  const sameMedia = previous && previous.mediaName === project.mediaName;
  return {
    key: keyOf(owner, project.id),
    owner,
    id: project.id,
    name: project.name || "Untitled reel",
    createdAt: previous?.createdAt ?? project.createdAt ?? project.updatedAt ?? Date.now(),
    updatedAt: project.updatedAt ?? Date.now(),
    duration: project.duration ?? previous?.duration ?? null,
    wordCount: project.words.length,
    mediaName: project.mediaName,
    hasMedia: Boolean(sameMedia && previous?.hasMedia),
    mediaSize: sameMedia ? (previous?.mediaSize ?? null) : null,
    thumb: project.thumb ?? (sameMedia ? (previous?.thumb ?? null) : null),
    project,
  };
}

// ---------------------------------------------------------------- API

/** Projects in the owner's folder, most recently edited first. */
export async function listProjects(owner: string): Promise<ProjectSummary[]> {
  const db = await openDb();
  let records: ProjectRecord[];
  if (!db) records = readFallback(owner);
  else {
    const tx = db.transaction(PROJECTS, "readonly");
    records = (await done(tx.objectStore(PROJECTS).index("owner").getAll(owner))) as ProjectRecord[];
  }
  return records.map(summaryOf).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(owner: string, id: string): Promise<Project | null> {
  const db = await openDb();
  if (!db) return readFallback(owner).find((item) => item.id === id)?.project ?? null;
  const tx = db.transaction(PROJECTS, "readonly");
  const record = (await done(tx.objectStore(PROJECTS).get(keyOf(owner, id)))) as ProjectRecord | undefined;
  return record?.project ?? null;
}

/** Save (insert or update) a project in the owner's folder. Returns its new summary. */
export async function saveProject(owner: string, project: Project): Promise<ProjectSummary> {
  const db = await openDb();
  if (!db) {
    const list = readFallback(owner);
    const previous = list.find((item) => item.id === project.id) ?? null;
    const record = recordFor(owner, project, previous);
    writeFallback(owner, [...list.filter((item) => item.id !== project.id), { ...record, hasMedia: false }]);
    return summaryOf(record);
  }
  const tx = db.transaction(PROJECTS, "readwrite");
  const store = tx.objectStore(PROJECTS);
  const previous = ((await done(store.get(keyOf(owner, project.id)))) as ProjectRecord | undefined) ?? null;
  const record = recordFor(owner, project, previous);
  store.put(record);
  await finished(tx);
  return summaryOf(record);
}

export async function deleteProject(owner: string, id: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    writeFallback(owner, readFallback(owner).filter((item) => item.id !== id));
    return;
  }
  const tx = db.transaction([PROJECTS, MEDIA], "readwrite");
  tx.objectStore(PROJECTS).delete(keyOf(owner, id));
  tx.objectStore(MEDIA).delete(keyOf(owner, id));
  await finished(tx);
}

/** Keep the attached video/audio with the project. Returns false when the device has no room. */
export async function saveMedia(owner: string, id: string, file: File): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    if (navigator.storage?.estimate) {
      const { quota = 0, usage = 0 } = await navigator.storage.estimate();
      if (quota && usage + file.size > quota * 0.9) return false;
    }
    void navigator.storage?.persist?.().catch(() => false);
    const record: MediaRecord = {
      key: keyOf(owner, id),
      owner,
      id,
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    };
    const tx = db.transaction([MEDIA, PROJECTS], "readwrite");
    tx.objectStore(MEDIA).put(record);
    const projects = tx.objectStore(PROJECTS);
    const existing = (await done(projects.get(keyOf(owner, id)))) as ProjectRecord | undefined;
    if (existing) projects.put({ ...existing, hasMedia: true, mediaName: file.name, mediaSize: file.size });
    await finished(tx);
    return true;
  } catch {
    return false;
  }
}

export async function loadMedia(owner: string, id: string): Promise<File | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(MEDIA, "readonly");
    const record = (await done(tx.objectStore(MEDIA).get(keyOf(owner, id)))) as MediaRecord | undefined;
    if (!record) return null;
    return new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified });
  } catch {
    return null;
  }
}

export async function copyMedia(owner: string, fromId: string, toId: string): Promise<boolean> {
  const file = await loadMedia(owner, fromId);
  return file ? saveMedia(owner, toId, file) : false;
}

/** Move every project (and its media) from one folder to another — e.g. guest work into a new account. */
export async function moveFolder(from: string, to: string): Promise<number> {
  if (from === to) return 0;
  const db = await openDb();
  if (!db) {
    const moving = readFallback(from);
    if (!moving.length) return 0;
    const target = readFallback(to).filter((item) => !moving.some((move) => move.id === item.id));
    writeFallback(to, [...target, ...moving.map((item) => ({ ...item, owner: to, key: keyOf(to, item.id) }))]);
    localStorage.removeItem(FALLBACK_PREFIX + from);
    return moving.length;
  }
  const tx = db.transaction([PROJECTS, MEDIA], "readwrite");
  const projects = tx.objectStore(PROJECTS);
  const media = tx.objectStore(MEDIA);
  const records = (await done(projects.index("owner").getAll(from))) as ProjectRecord[];
  const files = (await done(media.index("owner").getAll(from))) as MediaRecord[];
  for (const record of records) {
    projects.delete(record.key);
    projects.put({ ...record, owner: to, key: keyOf(to, record.id) });
  }
  for (const file of files) {
    media.delete(file.key);
    media.put({ ...file, owner: to, key: keyOf(to, file.id) });
  }
  await finished(tx);
  return records.length;
}

/** Bytes used by this browser for Cutline (projects + media), when the browser reports it. */
export async function storageUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}
