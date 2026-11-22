import type { CaptionMode, Cut, Word } from "@/lib/captions/types";

export type Cue = {
  id: string;
  start: number;
  end: number;
  words: Word[];
};

/** A silence longer than this always ends the caption on screen. */
export const CUE_GAP = 0.6;
/** A caption never stays up longer than this, however many words it holds. */
export const CUE_MAX_SPAN = 4.5;

export function uid(): string {
  return crypto.randomUUID();
}

/** Words in playback order (start, then end). Returns the same array when it is already ordered. */
export function sortWords<T extends { start: number; end: number }>(words: T[]): T[] {
  for (let index = 1; index < words.length; index += 1) {
    const prev = words[index - 1];
    const word = words[index];
    if (word.start < prev.start || (word.start === prev.start && word.end < prev.end)) {
      return [...words].sort((a, b) => a.start - b.start || a.end - b.end);
    }
  }
  return words;
}

/** Seconds of `cuts` that fall between `a` and `b` (removed time does not count as a pause). */
export function cutTimeBetween(a: number, b: number, cuts: Cut[] | undefined): number {
  if (!cuts?.length || b <= a) return 0;
  let total = 0;
  for (const cut of cuts) {
    const from = Math.max(a, cut.start);
    const to = Math.min(b, cut.end);
    if (to > from) total += to - from;
  }
  return total;
}

/** True when most of the word sits inside a removed range. */
export function inCut(word: { start: number; end: number }, cuts: Cut[] | undefined): boolean {
  if (!cuts?.length) return false;
  const mid = (word.start + word.end) / 2;
  return cuts.some((cut) => mid >= cut.start && mid < cut.end);
}

/**
 * Group words into on-screen captions. A caption ends when it is full, at a
 * line break, at any real silence (so a caption never hangs over a pause or
 * shows the next sentence early), or when it would stay up too long.
 */
export function buildCues(words: Word[], wordsPerCue: number, cuts?: Cut[]): Cue[] {
  const ordered = sortWords(words);
  const cues: Cue[] = [];
  let bucket: Word[] = [];
  let bucketEnd = 0;
  const limit = Math.max(1, Math.round(wordsPerCue));
  const flush = () => {
    if (!bucket.length) return;
    cues.push({
      id: bucket.map((word) => word.id).join("."),
      start: bucket[0].start,
      end: bucketEnd,
      words: bucket,
    });
    bucket = [];
    bucketEnd = 0;
  };
  for (const word of ordered) {
    if (bucket.length) {
      const silence = word.start - bucketEnd - cutTimeBetween(bucketEnd, word.start, cuts);
      const span = word.end - bucket[0].start - cutTimeBetween(bucket[0].start, word.end, cuts);
      if (silence > CUE_GAP || span > CUE_MAX_SPAN) flush();
    }
    bucket.push(word);
    bucketEnd = Math.max(bucketEnd, word.end);
    if (bucket.length >= limit || word.breakAfter) flush();
  }
  flush();
  return cues;
}

/**
 * Clean raw transcription timings: playback order, no duplicate words from
 * overlapping chunks, and no word that runs over the start of the next one.
 */
export function tidyWords(words: Word[]): Word[] {
  const ordered = [...sortWords(words)];
  const out: Word[] = [];
  for (const word of ordered) {
    const prev = out[out.length - 1];
    if (prev) {
      const same = prev.text.trim().toLowerCase() === word.text.trim().toLowerCase();
      if (same && Math.abs(prev.start - word.start) < 0.08) continue;
    }
    out.push({ ...word });
  }
  for (let index = 0; index < out.length - 1; index += 1) {
    const word = out[index];
    const next = out[index + 1];
    if (next.start < word.start + 0.04) {
      next.start = round(word.start + 0.04);
      next.end = round(Math.max(next.end, next.start + 0.04));
    }
    if (word.end > next.start) word.end = round(Math.max(word.start + 0.04, next.start));
  }
  return out;
}

/** How many words share time with another word (they stack on extra timeline lanes). */
export function overlapCount(words: Word[]): number {
  const ordered = sortWords(words);
  let count = 0;
  let reach = -Infinity;
  for (const word of ordered) {
    if (word.start < reach - 0.005) count += 1;
    reach = Math.max(reach, word.end);
  }
  return count;
}

export function activeWord(words: Word[], time: number): Word | null {
  return words.find((word) => time >= word.start && time < word.end) ?? null;
}

export function cueAt(words: Word[], time: number, wordsPerCue: number, mode: CaptionMode): Cue | null {
  if (!words.length) return null;
  if (mode === "single") {
    const hit = activeWord(words, time);
    const word =
      hit ??
      [...words].reverse().find((item) => item.end <= time && time - item.end < 0.16) ??
      null;
    if (!word) return null;
    return { id: word.id, start: word.start, end: word.end, words: [word] };
  }
  const cues = buildCues(words, wordsPerCue);
  const direct = [...cues].reverse().find((cue) => time >= cue.start - 0.02 && time <= cue.end + 0.03);
  if (direct) return direct;
  return [...cues].reverse().find((cue) => cue.end < time && time - cue.end < 0.2) ?? null;
}

export function projectSpan(words: Word[], mediaDuration: number | null): number {
  const wordEnd = words.reduce((max, word) => Math.max(max, word.end), 0);
  if (mediaDuration && mediaDuration > 0) return Math.max(mediaDuration, 0.1);
  return Math.max(wordEnd + 0.4, 8);
}

export function wordsFromScript(text: string, duration: number): Word[] {
  const tokens = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const weights = tokens.map((token) => {
    const clean = token.replace(/[.,!?;:۔،]/g, "");
    return Math.max(1, clean.length) + (/[.,!?۔]/.test(token) ? 6 : 0);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const span = Math.max(duration, tokens.length * 0.28);
  let cursor = 0;
  return tokens.map((token, index) => {
    const start = (cursor / total) * span;
    cursor += weights[index] ?? 1;
    const end = (cursor / total) * span;
    return {
      id: uid(),
      text: token,
      start: round(start),
      end: round(Math.max(end, start + 0.08)),
    };
  });
}

export function fitWords(words: Word[], duration: number): Word[] {
  if (!words.length) return words;
  const end = Math.max(...words.map((word) => word.end), 0.01);
  const scale = duration / end;
  return words.map((word) => ({
    ...word,
    start: round(Math.max(0, word.start * scale)),
    end: round(Math.max(word.start * scale + 0.05, word.end * scale)),
  }));
}

export function shiftWords(words: Word[], delta: number): Word[] {
  return words.map((word) => ({
    ...word,
    start: round(Math.max(0, word.start + delta)),
    end: round(Math.max(0.05, word.end + delta)),
  }));
}

export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) value = 0;
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const tenths = Math.floor((value - total) * 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function displayText(text: string, uppercase: boolean): string {
  return uppercase ? text.toUpperCase() : text;
}

export function lipSyncWords(words: Word[], peaks: number[], duration: number): Word[] {
  if (!words.length) return words;
  const last = words[words.length - 1]?.end ?? 0;
  const span = Math.max(duration, last, 0.4);
  const onsets = energyOnsets(peaks, span);
  if (onsets.length >= Math.min(words.length, 6)) {
    const marks = monotonic(sampleMarks(onsets, words.length, span));
    return words.map((word, index) => {
      const start = Math.max(0, marks[index] - 0.04);
      const next = index + 1 < marks.length ? marks[index + 1] : span;
      const natural = Math.max(0.09, Math.min(0.55, word.end - word.start || 0.22));
      const end = Math.min(Math.max(start + natural, start + 0.08), Math.max(start + 0.08, next - 0.02));
      return { ...word, start: round(start), end: round(Math.max(end, start + 0.08)) };
    });
  }
  return tightenLead(words);
}

function tightenLead(words: Word[]): Word[] {
  let prevEnd = 0;
  return words.map((word) => {
    const dur = Math.max(0.08, word.end - word.start);
    let start = Math.max(0, word.start - 0.045);
    if (start < prevEnd) start = prevEnd;
    const end = start + dur;
    prevEnd = end;
    return { ...word, start: round(start), end: round(end) };
  });
}

function energyOnsets(peaks: number[], span: number): number[] {
  if (peaks.length < 8) return [];
  const sorted = [...peaks].sort((a, b) => a - b);
  const thresh = sorted[Math.floor(sorted.length * 0.62)] || 0.08;
  const onsets: number[] = [];
  for (let index = 2; index < peaks.length; index += 1) {
    const prev = peaks[index - 1] ?? 0;
    const value = peaks[index] ?? 0;
    if (value >= thresh && value > prev * 1.25 && value > (peaks[index - 2] ?? 0)) {
      const time = (index / peaks.length) * span;
      if (!onsets.length || time - onsets[onsets.length - 1] > 0.09) onsets.push(time);
    }
  }
  return onsets;
}

function sampleMarks(onsets: number[], count: number, span: number): number[] {
  if (onsets.length === count) return onsets;
  if (onsets.length > count) {
    return Array.from({ length: count }, (_, index) => {
      const pick = Math.round((index * (onsets.length - 1)) / Math.max(1, count - 1));
      return onsets[pick] ?? 0;
    });
  }
  return Array.from({ length: count }, (_, index) => {
    const target = (index / count) * span * 0.92 + 0.05;
    let best = onsets[0] ?? target;
    let dist = Infinity;
    for (const onset of onsets) {
      const delta = Math.abs(onset - target);
      if (delta < dist) {
        dist = delta;
        best = onset;
      }
    }
    return dist < 0.18 ? best : target;
  });
}

function monotonic(marks: number[]): number[] {
  let last = 0;
  return marks.map((mark) => {
    const value = Math.max(mark, last + 0.08);
    last = value;
    return value;
  });
}
