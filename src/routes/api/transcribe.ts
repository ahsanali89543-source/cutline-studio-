import { createFileRoute } from "@tanstack/react-router";
import { ProviderError, configuredSpeechProviders, transcribeWithProviders } from "@/lib/ai.server";

// Vercel caps a function request body at ~4.5 MB; the studio sends compact
// audio chunks well under this.
const MAX_BYTES = 4.3 * 1024 * 1024;

/** Studio language id → the code the speech model is asked for. */
function speechLanguage(id: string): string {
  if (id === "roman-ur" || id === "pa") return "ur";
  if (id === "roman-hi") return "hi";
  return id.slice(0, 8);
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      GET: async () => {
        const providers = configuredSpeechProviders();
        return Response.json({ ok: providers.length > 0, providers });
      },
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ ok: false, error: "The audio did not arrive. Try again." }, { status: 400 });
        }
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ ok: false, error: "Attach an audio chunk." }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json({ ok: false, error: "Audio chunk is too large." }, { status: 413 });
        }
        const languageId = String(form.get("language") ?? "").slice(0, 12);
        const keyterms = String(form.get("keyterms") ?? "")
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 60);
        const diarize = String(form.get("diarize") ?? "") === "1";
        const prompt = String(form.get("prompt") ?? "").slice(0, 400);
        try {
          const result = await transcribeWithProviders({
            file,
            language: speechLanguage(languageId),
            keyterms,
            diarize,
            prompt,
          });
          return Response.json({
            ok: true,
            provider: result.provider,
            text: result.text,
            language: result.language,
            duration: result.duration,
            words: result.words.slice(0, 12000),
          });
        } catch (error) {
          const status = error instanceof ProviderError ? error.status : 502;
          const message = error instanceof Error ? error.message : "Transcription failed.";
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
