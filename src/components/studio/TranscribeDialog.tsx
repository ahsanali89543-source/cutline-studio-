import { Button } from "@/components/ui/button";
import { mediaBridge } from "@/lib/captions/media";
import { applyIncomingWords, useStudio } from "@/lib/captions/store";
import { transcribeAttached } from "@/lib/captions/transcribe-client";
import { LANGUAGES } from "@/lib/captions/types";
import { AlertTriangle, Languages, Sparkles, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

const FEATURED = ["roman-ur", "ur", "en", "hi", "roman-hi", ""];

export function TranscribeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const language = useStudio((state) => state.language);
  const busy = useStudio((state) => state.busy);
  const progress = useStudio((state) => state.progress);
  const [keyterms, setKeyterms] = useState(() => {
    try {
      return localStorage.getItem("cutline.keyterms") ?? "";
    } catch {
      return "";
    }
  });
  const [diarize, setDiarize] = useState(false);
  const [server, setServer] = useState<{ ok: boolean; providers: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void fetch("/api/transcribe")
      .then((response) => response.json())
      .then((data: { ok?: boolean; providers?: string[] }) => setServer({ ok: Boolean(data.ok), providers: data.providers ?? [] }))
      .catch(() => setServer(null));
  }, [open]);

  if (!open) return null;
  const running = Boolean(busy);

  async function start() {
    if (!mediaBridge.file) {
      setError("Upload a video or audio file first.");
      return;
    }
    try {
      localStorage.setItem("cutline.keyterms", keyterms);
    } catch {
      /* ignore */
    }
    setError(null);
    const studio = useStudio.getState();
    studio.setNote(null);
    try {
      const result = await transcribeAttached({
        language: studio.language,
        keyterms,
        diarize,
        onStep: (label, value) => useStudio.getState().setBusy(label, value),
      });
      if (!result.words.length) throw new Error("No speech was found in this clip.");
      // Model timestamps are word-accurate; just lead by a hair so text meets the mouth.
      applyIncomingWords(
        result.words.map((word) => ({ ...word, start: Math.max(0, word.start - 0.03) })),
        useStudio.getState().mediaDuration ?? undefined,
      );
      const label = LANGUAGES.find((item) => item.id === useStudio.getState().language)?.label ?? "your language";
      const roman =
        result.romanized === "ai"
          ? " Written in Roman Urdu by AI."
          : result.romanized === "rules" || result.romanized === "mixed"
            ? " Roman Urdu written with the offline converter — tap any word to polish it."
            : "";
      useStudio.getState().setNote(`${result.words.length} words transcribed (${label}${result.provider ? ` · ${result.provider}` : ""}).${roman}`);
      onClose();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Transcription failed.";
      setError(message);
      useStudio.getState().setNote(message);
    } finally {
      useStudio.getState().setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !running) onClose();
    }}>
      <div className="gradient-border fade-up relative w-full max-w-xl overflow-hidden rounded-2xl p-5 shadow-2xl">
        <div className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-accent-2/20 blur-3xl" />
        {!running ? (
          <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded-full p-2 text-muted hover:bg-white/5" aria-label="Close">
            <X className="size-4" />
          </button>
        ) : null}
        <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-accent-2 uppercase">
          <Sparkles className="size-3.5" /> AI transcription
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">What language is spoken?</h2>
        <p className="mt-1 text-sm text-muted">
          Roman Urdu: we transcribe the Urdu speech precisely, then write every word in English letters the way creators type.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FEATURED.map((id) => {
            const item = LANGUAGES.find((entry) => entry.id === id);
            if (!item) return null;
            const on = language === id;
            return (
              <button
                key={id || "auto"}
                type="button"
                disabled={running}
                onClick={() => useStudio.getState().setLanguage(id)}
                className={`relative rounded-xl border p-3 text-left transition ${on ? "border-accent bg-accent/15" : "border-line hover:border-white/25"}`}
              >
                {id === "roman-ur" ? <span className="pro-badge absolute -top-2 right-2 rounded px-1.5 py-0.5 text-[9px]">BEST</span> : null}
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block text-[11px] text-muted">{id === "roman-ur" ? "kya haal hai dosto" : id === "ur" ? "کیا حال ہے" : id === "hi" ? "क्या हाल है" : id === "roman-hi" ? "kya haal hai" : id === "en" ? "how are you" : "let AI decide"}</span>
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Languages className="size-3.5" />
          More languages
          <select
            className="h-8 flex-1 rounded-lg border border-line bg-surface px-2 text-sm text-fg"
            value={FEATURED.includes(language) ? "" : language}
            disabled={running}
            onChange={(event) => event.target.value && useStudio.getState().setLanguage(event.target.value)}
          >
            <option value="">Choose…</option>
            {LANGUAGES.filter((item) => !FEATURED.includes(item.id)).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-xs font-medium">
          Names & brand words <span className="font-normal text-muted">(optional — improves spelling)</span>
          <textarea
            value={keyterms}
            disabled={running}
            onChange={(event) => setKeyterms(event.target.value)}
            placeholder="e.g. Tesseract, Cutline, Daraz, Karachi"
            className="mt-1 h-16 w-full rounded-lg border border-line bg-black/30 p-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          disabled={running}
          onClick={() => setDiarize((value) => !value)}
          className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${diarize ? "border-accent bg-accent/10" : "border-line text-muted"}`}
        >
          <Users className="size-3.5" /> {diarize ? "Detecting speakers (podcasts, interviews)" : "Detect different speakers"}
        </button>

        {server && !server.ok ? (
          <p className="mt-3 flex gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-100">
            <AlertTriangle className="size-4 shrink-0" />
            The server has no transcription key yet. Add XAI_API_KEY, GROQ_API_KEY or OPENAI_API_KEY to the deployment's environment variables.
          </p>
        ) : null}
        {error ? <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-2.5 text-xs text-rose-100">{error}</p> : null}

        {running ? (
          <div className="mt-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 animate-spin text-accent-2" /> {busy}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${Math.round((progress ?? 0.05) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted">Your video stays on this device — only compact audio is sent for transcription.</p>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button tone="primary" size="md" className="shine" onClick={() => void start()} data-testid="start-transcribe">
              <Sparkles className="size-4" /> Transcribe now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
