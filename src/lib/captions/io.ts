import type { Word } from "@/lib/captions/types";
import { buildCues, round, sortWords, uid } from "@/lib/captions/timing";

function stamp(value: number, comma: boolean): string {
  const ms = Math.max(0, Math.round(value * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  const tail = String(millis).padStart(3, "0");
  const body = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  return comma ? `${body},${tail}` : `${body}.${tail}`;
}

function parseStamp(raw: string): number | null {
  const match = raw.trim().match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const frac = match[4].padEnd(3, "0").slice(0, 3);
  return hours * 3600 + minutes * 60 + seconds + Number(frac) / 1000;
}

export function toSrt(words: Word[], wordsPerCue: number, wordLevel = false): string {
  const cues = wordLevel
    ? sortWords(words).map((word) => ({ start: word.start, end: word.end, text: word.text }))
    : buildCues(words, wordsPerCue).map((cue) => ({
        start: cue.start,
        end: cue.end,
        text: cue.words.map((word) => word.text).join(" "),
      }));
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${stamp(cue.start, true)} --> ${stamp(cue.end, true)}\n${cue.text}`,
    )
    .join("\n\n");
}

export function toVtt(words: Word[], wordsPerCue: number): string {
  const cues = buildCues(words, wordsPerCue);
  const body = cues
    .map((cue) => {
      const text = cue.words.map((word) => word.text).join(" ");
      return `${stamp(cue.start, false)} --> ${stamp(cue.end, false)}\n${text}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function toPlain(words: Word[]): string {
  return words.map((word) => word.text).join(" ");
}

export function toJson(name: string, words: Word[]): string {
  return JSON.stringify(
    {
      name,
      words: words.map(({ text, start, end, speaker, emphasis, breakAfter }) => ({
        text,
        start,
        end,
        speaker,
        emphasis: emphasis || undefined,
        breakAfter: breakAfter || undefined,
      })),
    },
    null,
    2,
  );
}

export function parseTranscript(input: string): Word[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJson(trimmed);
  if (trimmed.includes("-->")) return parseTimedText(trimmed);
  return [];
}

function parseJson(input: string): Word[] {
  const data = JSON.parse(input) as unknown;
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { words?: unknown }).words)
      ? (data as { words: unknown[] }).words
      : [];
  return sanitizeWords(list);
}

function parseTimedText(input: string): Word[] {
  const blocks = input.replace(/\r/g, "").split(/\n{2,}/);
  const words: Word[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;
    const [left, right] = timeLine.split("-->");
    const start = parseStamp(left ?? "");
    // "00:00:01,000 --> 00:00:02,400 align:start" — trim first: SRT puts spaces around the arrow.
    const end = parseStamp((right ?? "").trim().split(/\s+/)[0] ?? "");
    if (start == null || end == null) continue;
    const text = lines
      .filter((line) => line !== timeLine && !/^\d+$/.test(line) && line !== "WEBVTT")
      .join(" ")
      .replace(/<[^>]+>/g, "");
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const span = Math.max(0.05, (end - start) / tokens.length);
    tokens.forEach((token, index) => {
      words.push({
        id: uid(),
        text: token,
        start: round(start + index * span),
        end: round(start + (index + 1) * span),
      });
    });
  }
  return words;
}

export function sanitizeWords(list: unknown[]): Word[] {
  const words: Word[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = String(row.text ?? "").trim();
    const start = Number(row.start);
    const end = Number(row.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    const speaker = Number(row.speaker);
    words.push({
      id: uid(),
      text,
      start: round(Math.max(0, start)),
      end: round(Math.max(start + 0.04, end)),
      emphasis: Boolean(row.emphasis),
      breakAfter: Boolean(row.breakAfter),
      speaker: Number.isFinite(speaker) ? speaker : undefined,
    });
  }
  const max = words.reduce((value, word) => Math.max(value, word.end), 0);
  if (max > 1000) {
    return words.map((word) => ({
      ...word,
      start: round(word.start / 1000),
      end: round(word.end / 1000),
    }));
  }
  return words;
}

export function downloadText(filename: string, contents: string, type: string) {
  downloadBlob(filename, new Blob([contents], { type }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function safeName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "cutline";
}
