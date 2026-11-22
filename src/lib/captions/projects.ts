/**
 * "My Recent Projects": open, create, duplicate, delete, export and import
 * projects in the signed-in user's own folder, and bring each project's video
 * back when it is reopened.
 */
import { useAccount } from "@/lib/account";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { demoProject } from "@/lib/captions/demo";
import { downloadText, safeName } from "@/lib/captions/io";
import { mediaBridge, releaseMedia } from "@/lib/captions/media";
import {
  GUEST_OWNER,
  copyMedia,
  deleteProject,
  listProjects,
  loadMedia,
  loadProject,
  moveFolder,
  saveMedia,
  saveProject,
} from "@/lib/captions/projects-db";
import { blankProject, flushSave, hydrate, readLegacyProjects, saveCurrentNow, useStudio } from "@/lib/captions/store";
import { uid } from "@/lib/captions/timing";
import type { Project } from "@/lib/captions/types";
import { useEffect, useState } from "react";

const MIGRATED_KEY = "cutline.projects.migrated.v3";
const FILE_FORMAT = "cutline-project";
const FILE_VERSION = 3;

/** Folder owner for the current visitor: a real login, a creator pass, or this device's guest folder. Null while still resolving. */
export function useProjectOwner(): string | null {
  const ready = useAccount((state) => state.ready);
  const creator = useAccount((state) => state.creator);
  const { user, isPending } = useCurrentUserState();
  // A slow or unreachable login server must not keep the studio on its splash screen.
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    if (!isPending) return;
    const timer = window.setTimeout(() => setWaitedOut(true), 2500);
    return () => window.clearTimeout(timer);
  }, [isPending]);
  if (!ready) return null;
  if (creator?.email) return `creator:${creator.email.toLowerCase()}`;
  if (isPending && !waitedOut) return null;
  if (user && !user.isDevFallback) return `user:${user.id}`;
  return GUEST_OWNER;
}

/** Media is loaded lazily to avoid an import cycle (load-media imports the store). */
async function attachSavedMedia(owner: string, project: Project): Promise<boolean> {
  if (!project.mediaName) return false;
  const file = await loadMedia(owner, project.id);
  const state = useStudio.getState();
  if (!file || state.project.id !== project.id || state.owner !== owner) return false;
  const { loadMediaFile } = await import("@/lib/captions/load-media");
  await loadMediaFile(file, { restore: true });
  return true;
}

function clearPicture() {
  releaseMedia();
  const video = mediaBridge.video;
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

async function showProject(owner: string, project: Project) {
  clearPicture();
  useStudio.getState().loadIntoStudio(project, {
    note: project.mediaName ? `Opening ${project.mediaName}…` : null,
  });
  const restored = await attachSavedMedia(owner, project).catch(() => false);
  if (useStudio.getState().project.id !== project.id) return;
  if (project.mediaName && !restored) {
    useStudio.getState().setNote(`Re-attach ${project.mediaName} (Upload video) to see the picture again — it was not kept on this device.`);
  } else if (restored) {
    useStudio.getState().setNote(null);
  }
}

function showSample() {
  clearPicture();
  useStudio.getState().loadIntoStudio(demoProject(), { sample: true });
}

async function migrateLegacy(owner: string) {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
    const legacy = readLegacyProjects();
    for (const project of legacy) {
      // The old demo shared one ID for everybody — give it its own.
      const id = project.id === "demo" ? uid() : project.id;
      await saveProject(owner, { ...project, id, createdAt: project.createdAt ?? project.updatedAt });
    }
    localStorage.setItem(MIGRATED_KEY, String(Date.now()));
  } catch {
    /* keep going with whatever is there */
  }
}

/** First load of the studio: open the owner's most recent project, or the demo when the folder is empty. */
export async function bootLibrary(owner: string) {
  const state = useStudio.getState();
  state.setOwner(owner);
  await migrateLegacy(owner);
  // Work made on this device before logging in belongs to whoever logs in.
  if (owner !== GUEST_OWNER) await moveFolder(GUEST_OWNER, owner).catch(() => 0);
  const library = await listProjects(owner).catch(() => []);
  useStudio.getState().setLibrary(library);
  const latest = library[0];
  if (latest) {
    const project = await loadProject(owner, latest.id).catch(() => null);
    if (project) {
      await showProject(owner, hydrate(project));
      return;
    }
  }
  showSample();
}

/**
 * Sign-in / sign-out. A guest who signs in takes the guest folder into the
 * account (so nothing made before logging in is lost); any other change opens
 * the new owner's own folder.
 */
export async function switchOwner(next: string) {
  const state = useStudio.getState();
  const previous = state.owner;
  if (!previous || previous === next) return;
  await flushSave();
  if (previous === GUEST_OWNER) {
    await moveFolder(GUEST_OWNER, next).catch(() => 0);
    useStudio.getState().setOwner(next);
    const library = await listProjects(next).catch(() => []);
    useStudio.getState().setLibrary(library);
    if (!useStudio.getState().isSample) {
      await saveCurrentNow();
      return;
    }
    // Still on the demo: open the account's own latest project instead.
    const latest = library[0];
    const project = latest ? await loadProject(next, latest.id).catch(() => null) : null;
    if (project) await showProject(next, hydrate(project));
    return;
  }
  useStudio.getState().setOwner(next);
  const library = await listProjects(next).catch(() => []);
  useStudio.getState().setLibrary(library);
  const latest = library[0];
  const project = latest ? await loadProject(next, latest.id).catch(() => null) : null;
  if (project) await showProject(next, hydrate(project));
  else showSample();
}

export async function refreshLibrary() {
  const owner = useStudio.getState().owner;
  if (!owner) return;
  const library = await listProjects(owner).catch(() => null);
  if (library) useStudio.getState().setLibrary(library);
}

export async function openSavedProject(id: string) {
  const owner = useStudio.getState().owner;
  if (!owner || useStudio.getState().project.id === id) return;
  await flushSave();
  const project = await loadProject(owner, id).catch(() => null);
  if (!project) {
    useStudio.getState().setNote("That project could not be found in this folder.");
    await refreshLibrary();
    return;
  }
  await showProject(owner, hydrate(project));
}

/** A fresh, empty project with its own ID, keeping the current caption style. */
export async function createNewProject() {
  await flushSave();
  const current = useStudio.getState().project;
  const project = blankProject({
    look: current.look,
    aspect: current.aspect,
    fit: current.fit,
    gradeId: current.gradeId,
    voice: current.voice,
  });
  clearPicture();
  useStudio.getState().loadIntoStudio(project);
  await saveCurrentNow();
}

export async function renameSavedProject(id: string, name: string) {
  const owner = useStudio.getState().owner;
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!owner || !clean) return;
  if (useStudio.getState().project.id === id) {
    useStudio.getState().rename(clean);
    await flushSave();
    return;
  }
  const project = await loadProject(owner, id).catch(() => null);
  if (!project) return;
  const summary = await saveProject(owner, { ...project, name: clean, updatedAt: Date.now() });
  useStudio.getState().upsertSummary(summary);
}

export async function duplicateSavedProject(id: string) {
  const owner = useStudio.getState().owner;
  if (!owner) return;
  await flushSave();
  const source = useStudio.getState().project.id === id ? useStudio.getState().project : await loadProject(owner, id).catch(() => null);
  if (!source) return;
  const now = Date.now();
  const copy: Project = { ...hydrate(source), id: uid(), name: `${source.name} (copy)`, createdAt: now, updatedAt: now };
  const summary = await saveProject(owner, copy);
  useStudio.getState().upsertSummary(summary);
  if (source.mediaName && (await copyMedia(owner, id, copy.id))) await refreshLibrary();
}

export async function deleteSavedProject(id: string) {
  const owner = useStudio.getState().owner;
  if (!owner) return;
  const wasOpen = useStudio.getState().project.id === id;
  if (wasOpen) await flushSave();
  await deleteProject(owner, id).catch(() => undefined);
  useStudio.getState().dropSummary(id);
  if (!wasOpen) return;
  const next = useStudio.getState().library[0];
  const project = next ? await loadProject(owner, next.id).catch(() => null) : null;
  if (project) await showProject(owner, hydrate(project));
  else showSample();
}

/** Download a project as a `.cutline` file (words, style, cuts — the video stays on this device). */
export async function exportProjectFile(id?: string) {
  const state = useStudio.getState();
  const owner = state.owner;
  const targetId = id ?? state.project.id;
  let project: Project | null = state.project.id === targetId ? state.project : null;
  if (!project && owner) project = await loadProject(owner, targetId).catch(() => null);
  if (!project) return;
  const payload = { format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), project: { ...project, thumb: project.thumb ?? null } };
  downloadText(`${safeName(project.name)}.cutline`, JSON.stringify(payload, null, 2), "application/json");
}

/** Open a `.cutline` file as a new project in the user's folder (always under a new ID). */
export async function importProjectFile(file: File) {
  const owner = useStudio.getState().owner;
  if (!owner) return;
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    useStudio.getState().setNote("That is not a Cutline project file.");
    return;
  }
  const raw = (data && typeof data === "object" && "project" in data ? (data as { project: unknown }).project : data) as Project | null;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.words)) {
    useStudio.getState().setNote("That is not a Cutline project file.");
    return;
  }
  await flushSave();
  const now = Date.now();
  const project = hydrate({ ...raw, id: uid(), createdAt: now, updatedAt: now });
  await saveProject(owner, project);
  await refreshLibrary();
  await showProject(owner, project);
  useStudio
    .getState()
    .setNote(project.mediaName ? `Project opened. Upload ${project.mediaName} to see the picture.` : `Project “${project.name}” opened.`);
}

/**
 * Called when a video/audio file is loaded. The demo turns into a new project
 * named after the file; an untitled project takes the file's name.
 */
export function prepareProjectForMedia(file: File) {
  const state = useStudio.getState();
  const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "Untitled reel";
  if (state.isSample) {
    clearWordsOfSample(title);
    return;
  }
  if (state.project.name === "Untitled reel") state.rename(title);
}

function clearWordsOfSample(title: string) {
  const state = useStudio.getState();
  // The demo's words belong to the demo, not to this video.
  const name = state.project.name === "Demo reel" || !state.project.name.trim() ? title : state.project.name;
  state.promoteSample({ name, words: [], speakers: {}, mediaName: null, duration: null, thumb: null, splits: [], cuts: [] });
  useStudio.setState({ past: [], future: [], selectedId: null, selectedIds: [], playhead: 0 });
}

/** Keep the file with the open project so reopening it later restores the picture. */
export async function keepMediaWithProject(file: File) {
  const state = useStudio.getState();
  if (!state.owner || state.isSample) return;
  const projectId = state.project.id;
  await saveCurrentNow();
  const ok = await saveMedia(state.owner, projectId, file);
  if (ok) await refreshLibrary();
  else if (useStudio.getState().project.id === projectId) {
    useStudio.getState().setNote(`${file.name} is too large to keep on this device — the project is saved; re-attach the video when you reopen it.`);
  }
}
