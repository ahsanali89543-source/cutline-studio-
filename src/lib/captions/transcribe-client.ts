import { mediaBridge } from "@/lib/captions/media";
import { SPEECH_RATE, canEncodeSpeechOpus, decodeSpeechPcm, encodeSpeechChunk, planChunks } from "@/lib/captions/media-engine";
import { needsRomanizing, romanizeTokens } from "@/lib/captions/roman";

export type TranscribeOptions = {
  language: string;
  keyterms: string;
  diarize: boolean;
  onStep: (label: string, progress: number) => void;
};

export type TranscribedWord = { text: string; start: number; end: number; speaker?: number };

export type TranscribeOutcome = {
  words: TranscribedWord[];
  language: string | null;
  provider: string | null;
  romanized: "ai" | "rules" | "mixed" | "none";
};

export function isRomanLanguage(language: string) {
  return language === "roman-ur" || language === "roman-hi" || language === "pa";
}

/** Get (and cache) the decoded voice track for the attached file. */
export function speechPcm(onProgress?: (value: number) => void): Promise<Float32Array> {
  const file = mediaBridge.file;
  if (!file) return Promise.reject(new Error("Upload a video or audio file first."));
  if (!mediaBridge.pcm) {
    mediaBridge.pcm = decodeSpeechPcm(file, onProgress).catch((error) => {
      mediaBridge.pcm = null;
      throw error;
    });
  }
  return mediaBridge.pcm;
}

async function postChunk(blob: Blob, name: string, options: TranscribeOptions, attempt = 0): Promise<{
  words: TranscribedWord[];
  language: string | null;
  provider: string | null;
  text: string;
}> {
  const body = new FormData();
  body.append("language", options.language);
  if (options.keyterms.trim()) body.append("keyterms", options.keyterms);
  if (options.diarize) body.append("diarize", "1");
  body.append("file", blob, name);
  let response: Response;
  try {
    response = await fetch("/api/transcribe", { method: "POST", body });
  } catch {
    if (attempt < 1) return postChunk(blob, name, options, attempt + 1);
    throw new Error("Could not reach the transcription server. Check your connection and try again.");
  }
  let data: { ok?: boolean; error?: string; words?: TranscribedWord[]; language?: string; provider?: string; text?: string };
  try {
    data = await response.json();
  } catch {
    data = { ok: false, error: `Server answered ${response.status}.` };
  }
  if (!response.ok || !data.ok) {
    if (attempt < 1 && response.status >= 500 && response.status !== 503) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return postChunk(blob, name, options, attempt + 1);
    }
    throw new Error(data.error || `Transcription failed (${response.status}).`);
  }
  return {
    words: Array.isArray(data.words) ? data.words : [],
    language: data.language ?? null,
    provider: data.provider ?? null,
    text: data.text ?? "",
  };
}

export async function transcribeAttached(options: TranscribeOptions): Promise<TranscribeOutcome> {
  options.onStep("Reading the voice track…", 0.02);
  const pcm = await speechPcm((value) => options.onStep("Reading the voice track…", 0.02 + value * 0.18));
  const duration = pcm.length / SPEECH_RATE;
  if (duration < 0.3) throw new Error("This clip has no audible speech.");
  const opus = await canEncodeSpeechOpus();
  // Keep each upload under ~3 MB: Ogg/Opus ≈ 4 KB/s, WAV ≈ 32 KB/s.
  const chunks = planChunks(pcm, opus ? 480 : 90);
  const results: { offset: number; words: TranscribedWord[]; language: string | null; provider: string | null; text: string }[] =
    new Array(chunks.length);
  let done = 0;
  let next = 0;
  const label = () =>
    chunks.length > 1 ? `Transcribing part ${Math.min(done + 1, chunks.length)} of ${chunks.length}…` : "Transcribing with AI…";
  options.onStep(label(), 0.22);
  const worker = async () => {
    while (next < chunks.length) {
      const index = next;
      next += 1;
      const chunk = chunks[index];
      const slice = pcm.subarray(Math.floor(chunk.start * SPEECH_RATE), Math.floor(chunk.end * SPEECH_RATE));
      const { blob, name } = await encodeSpeechChunk(slice);
      const answer = await postChunk(blob, name, options);
      results[index] = { offset: chunk.start, ...answer };
      done += 1;
      options.onStep(label(), 0.22 + (done / chunks.length) * 0.6);
    }
  };
  await Promise.all([worker(), worker()]);

  let words: TranscribedWord[] = [];
  for (const result of results) {
    for (const word of result.words) {
      const start = Number(word.start) + result.offset;
      const end = Number(word.end) + result.offset;
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      words.push({ text: String(word.text).trim(), start, end: Math.max(end, start + 0.05), speaker: word.speaker });
    }
  }
  words = words.filter((word) => word.text).sort((a, b) => a.start - b.start);
  const language = results.find((item) => item.language)?.language ?? null;
  const provider = results.find((item) => item.provider)?.provider ?? null;

  let romanized: TranscribeOutcome["romanized"] = "none";
  if (isRomanLanguage(options.language) && words.some((word) => needsRomanizing(word.text))) {
    options.onStep("Writing it in Roman Urdu…", 0.86);
    const tokens = words.map((word) => word.text);
    const out = await romanize(tokens, options.language === "roman-hi" ? "roman-hi" : "roman-ur");
    romanized = out.engine;
    words = words.map((word, index) => ({ ...word, text: out.tokens[index] || word.text }));
  }
  options.onStep("Snapping words to the voice…", 0.97);
  return { words, language, provider, romanized };
}

export async function romanize(
  tokens: string[],
  style: "roman-ur" | "roman-hi",
): Promise<{ tokens: string[]; engine: TranscribeOutcome["romanized"] }> {
  const out: string[] = [];
  const engines = new Set<string>();
  for (let index = 0; index < tokens.length; index += 420) {
    const batch = tokens.slice(index, index + 420);
    try {
      const response = await fetch("/api/romanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: batch, style }),
      });
      const data = (await response.json()) as { ok?: boolean; tokens?: string[]; engine?: string };
      if (response.ok && data.ok && Array.isArray(data.tokens) && data.tokens.length === batch.length) {
        out.push(...data.tokens);
        engines.add(data.engine ?? "ai");
        continue;
      }
    } catch {
      /* use the offline rules */
    }
    out.push(...romanizeTokens(batch));
    engines.add("rules");
  }
  const engine = engines.size > 1 ? "mixed" : ((Array.from(engines)[0] ?? "none") as TranscribeOutcome["romanized"]);
  return { tokens: out, engine };
}
