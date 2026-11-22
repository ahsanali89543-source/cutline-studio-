/**
 * Server-only speech + text providers for Cutline.
 *
 * Transcription tries every configured provider in order until one answers:
 *   1. xAI Grok Voice Transcribe (XAI_API_KEY — injected by the Grok platform)
 *   2. Groq Whisper large-v3   (GROQ_API_KEY — free tier is generous)
 *   3. OpenAI Whisper          (OPENAI_API_KEY)
 * Set TRANSCRIBE_PROVIDERS="groq,xai" (comma list) to change the order.
 *
 * Roman Urdu: speech is transcribed in Urdu/Hindi script (far more accurate
 * than asking a model to "hear" Roman letters), then a language model rewrites
 * each word in Roman Urdu. `romanize.ts` is the offline fallback.
 */

export type SttWord = { text: string; start: number; end: number; speaker?: number };
export type SttResult = {
  provider: string;
  text: string;
  language: string | null;
  duration: number | null;
  words: SttWord[];
};

type Provider = "xai" | "groq" | "openai";

const env = (key: string) => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

export function configuredSpeechProviders(): Provider[] {
  const all: Provider[] = ["xai", "groq", "openai"];
  const wanted = (env("TRANSCRIBE_PROVIDERS") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is Provider => (all as string[]).includes(item));
  const order = wanted.length ? [...wanted, ...all.filter((item) => !wanted.includes(item))] : all;
  return order.filter((provider) => Boolean(keyFor(provider)));
}

function keyFor(provider: Provider): string | undefined {
  if (provider === "xai") return env("XAI_API_KEY");
  if (provider === "groq") return env("GROQ_API_KEY");
  return env("OPENAI_API_KEY");
}

function baseFor(provider: Provider): string {
  if (provider === "xai") return (env("XAI_BASE_URL") ?? "https://api.x.ai/v1").replace(/\/+$/, "");
  if (provider === "groq") return (env("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
  return (env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      const message = typeof data.error === "string" ? data.error : data.error?.message ?? data.message;
      if (message) return message.slice(0, 240);
    } catch {
      /* not JSON */
    }
    return text.slice(0, 240) || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function transcribeWithProviders(input: {
  file: File;
  language: string;
  keyterms: string[];
  diarize: boolean;
  prompt?: string;
}): Promise<SttResult> {
  const providers = configuredSpeechProviders();
  if (!providers.length) {
    throw new ProviderError(
      "none",
      503,
      "No transcription key is set on the server. Add XAI_API_KEY, GROQ_API_KEY or OPENAI_API_KEY.",
    );
  }
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = provider === "xai" ? await xaiStt(input) : await whisperStt(provider, input);
      if (!result.words.length && !result.text.trim()) {
        errors.push(`${provider}: heard no speech`);
        continue;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
    }
  }
  throw new ProviderError("all", 502, errors.join(" · "));
}

async function xaiStt(input: { file: File; language: string; keyterms: string[]; diarize: boolean }): Promise<SttResult> {
  const form = new FormData();
  // Options must precede the file — xAI ignores fields sent after it.
  form.append("model", env("XAI_STT_MODEL") ?? "grok-voice-transcribe-2.0");
  if (input.language) form.append("language", input.language);
  if (input.diarize) form.append("diarize", "true");
  for (const term of input.keyterms.slice(0, 100)) form.append("keyterm", term.slice(0, 50));
  form.append("file", input.file, input.file.name || "audio.webm");
  const response = await fetch(`${baseFor("xai")}/stt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${keyFor("xai")}` },
    body: form,
  });
  if (!response.ok) throw new ProviderError("xai", response.status, `${response.status} ${await readError(response)}`);
  const data = (await response.json()) as {
    text?: string;
    language?: string;
    duration?: number;
    words?: { text?: string; word?: string; start?: number; end?: number; speaker?: number }[];
  };
  return {
    provider: "xai",
    text: data.text ?? "",
    language: data.language ?? input.language ?? null,
    duration: typeof data.duration === "number" ? data.duration : null,
    words: cleanWords(data.words ?? []),
  };
}

async function whisperStt(
  provider: "groq" | "openai",
  input: { file: File; language: string; keyterms: string[]; prompt?: string },
): Promise<SttResult> {
  const form = new FormData();
  const model =
    provider === "groq" ? env("GROQ_STT_MODEL") ?? "whisper-large-v3" : env("OPENAI_STT_MODEL") ?? "whisper-1";
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");
  if (input.language) form.append("language", input.language);
  const prompt = [input.prompt, input.keyterms.join(", ")].filter(Boolean).join(" ").slice(0, 600);
  if (prompt) form.append("prompt", prompt);
  form.append("file", input.file, input.file.name || "audio.webm");
  const response = await fetch(`${baseFor(provider)}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${keyFor(provider)}` },
    body: form,
  });
  if (!response.ok) {
    throw new ProviderError(provider, response.status, `${response.status} ${await readError(response)}`);
  }
  const data = (await response.json()) as {
    text?: string;
    language?: string;
    duration?: number;
    words?: { word?: string; text?: string; start?: number; end?: number }[];
    segments?: { text?: string; start?: number; end?: number }[];
  };
  let words = cleanWords(data.words ?? []);
  if (!words.length && data.segments?.length) words = wordsFromSegments(data.segments);
  return {
    provider,
    text: data.text ?? "",
    language: normalizeLanguage(data.language) ?? input.language ?? null,
    duration: typeof data.duration === "number" ? data.duration : null,
    words,
  };
}

function normalizeLanguage(language: string | undefined): string | null {
  if (!language) return null;
  const names: Record<string, string> = { urdu: "ur", hindi: "hi", english: "en", arabic: "ar", punjabi: "pa" };
  return names[language.toLowerCase()] ?? language;
}

function cleanWords(list: { text?: string; word?: string; start?: number; end?: number; speaker?: number }[]): SttWord[] {
  const out: SttWord[] = [];
  for (const item of list) {
    const text = String(item.text ?? item.word ?? "").trim();
    const start = Number(item.start);
    const end = Number(item.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    const word: SttWord = { text, start, end: Math.max(end, start + 0.04) };
    if (typeof item.speaker === "number") word.speaker = item.speaker;
    // Whisper sometimes emits punctuation as its own token — glue it on.
    if (/^[.,!?;:،۔؟]+$/.test(text) && out.length) {
      out[out.length - 1].text += text;
      continue;
    }
    out.push(word);
  }
  return out;
}

function wordsFromSegments(segments: { text?: string; start?: number; end?: number }[]): SttWord[] {
  const out: SttWord[] = [];
  for (const segment of segments) {
    const tokens = String(segment.text ?? "").trim().split(/\s+/).filter(Boolean);
    const start = Number(segment.start ?? 0);
    const end = Number(segment.end ?? start + tokens.length * 0.3);
    const total = tokens.reduce((sum, token) => sum + Math.max(1, token.length), 0) || 1;
    let cursor = start;
    for (const token of tokens) {
      const span = ((end - start) * Math.max(1, token.length)) / total;
      out.push({ text: token, start: cursor, end: cursor + span });
      cursor += span;
    }
  }
  return out;
}

// ---------------------------------------------------------------- text models

type ChatProvider = { provider: Provider; models: string[] };

function chatProviders(): ChatProvider[] {
  const list: ChatProvider[] = [];
  const pick = (value: string | undefined, fallback: string[]) =>
    value ? [value, ...fallback.filter((item) => item !== value)] : fallback;
  if (keyFor("xai")) {
    list.push({ provider: "xai", models: pick(env("XAI_TEXT_MODEL"), ["grok-4.20-non-reasoning", "grok-4.5"]) });
  }
  if (keyFor("groq")) {
    list.push({ provider: "groq", models: pick(env("GROQ_TEXT_MODEL"), ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]) });
  }
  if (keyFor("openai")) {
    list.push({ provider: "openai", models: pick(env("OPENAI_TEXT_MODEL"), ["gpt-4.1-mini", "gpt-4o-mini"]) });
  }
  return list;
}

export function hasTextModel(): boolean {
  return chatProviders().length > 0;
}

/** One chat completion; walks providers and model fallbacks until one answers. */
export async function chatComplete(system: string, user: string, maxTokens = 4000): Promise<string> {
  const errors: string[] = [];
  for (const { provider, models } of chatProviders()) {
    for (const model of models) {
      try {
        const body: Record<string, unknown> = {
          model,
          temperature: 0,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        };
        if (provider === "groq" && model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
        const response = await fetch(`${baseFor(provider)}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${keyFor(provider)}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const message = await readError(response);
          errors.push(`${provider}/${model}: ${response.status} ${message}`);
          // A missing model is worth one more try with the next model id; auth errors are not.
          if (response.status === 401 || response.status === 403) break;
          continue;
        }
        const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content ?? "";
        if (content.trim()) return content;
        errors.push(`${provider}/${model}: empty reply`);
      } catch (error) {
        errors.push(`${provider}/${model}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  throw new Error(errors.join(" · ") || "No language model is configured.");
}
