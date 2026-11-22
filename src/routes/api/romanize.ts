import { createFileRoute } from "@tanstack/react-router";
import { chatComplete, hasTextModel } from "@/lib/ai.server";
import { needsRomanizing, romanizeTokens } from "@/lib/captions/roman";

const BATCH = 140;

const SYSTEM = `You transliterate speech transcripts into Roman Urdu — Urdu/Hindi written in English letters exactly the way Pakistani creators type on Instagram, TikTok and WhatsApp.
Rules:
- You receive a JSON array of tokens (words) in order. Return JSON {"r":[...]} with EXACTLY the same number of items, same order, one output per input token. Never merge, split, drop or add tokens.
- Write natural Roman Urdu spellings: hai, hain, kya, nahi, mein, main, aap, hum, tum, ke, ki, ka, ko, se, par, bhi, to, aur, yeh, woh, kaise, kyun, bohat, acha, theek, zaroor, shukriya, InshaAllah, MashaAllah, yaar, bhai, dosto.
- English loanwords go back to normal English spelling: video, channel, subscribe, like, share, comment, phone, business, marketing, content, reel, offer, discount, brand, product, online, app.
- Keep names and brands capitalised (Pakistan, Karachi, Lahore, Instagram, YouTube).
- Keep punctuation attached to its token; Urdu "۔" becomes "." and "،" becomes "," and "؟" becomes "?".
- Tokens already in Latin letters stay unchanged. Numbers become digits.
- Output only the JSON object, nothing else.`;

function parseList(text: string): string[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(text.slice(start, end + 1)) as { r?: unknown };
    if (!Array.isArray(data.r)) return null;
    return data.r.map((item) => String(item ?? ""));
  } catch {
    return null;
  }
}

async function romanizeBatch(tokens: string[], style: string): Promise<{ out: string[]; ai: boolean }> {
  const hint =
    style === "roman-hi"
      ? "Style: Hinglish (Indian Roman Hindi) spellings are fine."
      : "Style: Pakistani Roman Urdu.";
  try {
    const reply = await chatComplete(SYSTEM, `${hint}\nTokens:\n${JSON.stringify(tokens)}`, 6000);
    const list = parseList(reply);
    if (list && list.length === tokens.length) {
      return {
        out: list.map((item, index) => {
          const cleaned = item.trim();
          // A model answer that still contains script falls back to the rules.
          if (!cleaned || needsRomanizing(cleaned)) return romanizeTokens([tokens[index]])[0];
          return cleaned;
        }),
        ai: true,
      };
    }
  } catch {
    /* fall through to rules */
  }
  return { out: romanizeTokens(tokens), ai: false };
}

export const Route = createFileRoute("/api/romanize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { tokens?: unknown; style?: unknown };
        try {
          body = (await request.json()) as { tokens?: unknown; style?: unknown };
        } catch {
          return Response.json({ ok: false, error: "Send JSON." }, { status: 400 });
        }
        const tokens = Array.isArray(body.tokens) ? body.tokens.slice(0, 4000).map((item) => String(item ?? "")) : [];
        const style = String(body.style ?? "roman-ur");
        if (!tokens.length) return Response.json({ ok: true, tokens: [], engine: "none" });
        if (!tokens.some(needsRomanizing)) return Response.json({ ok: true, tokens, engine: "none" });
        if (!hasTextModel()) return Response.json({ ok: true, tokens: romanizeTokens(tokens), engine: "rules" });

        const batches: string[][] = [];
        for (let index = 0; index < tokens.length; index += BATCH) batches.push(tokens.slice(index, index + BATCH));
        const results: { out: string[]; ai: boolean }[] = new Array(batches.length);
        let next = 0;
        const worker = async () => {
          while (next < batches.length) {
            const mine = next;
            next += 1;
            const batch = batches[mine];
            results[mine] = batch.some(needsRomanizing) ? await romanizeBatch(batch, style) : { out: batch, ai: true };
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        const out = results.flatMap((item) => item.out);
        const engine = results.every((item) => item.ai) ? "ai" : results.some((item) => item.ai) ? "mixed" : "rules";
        return Response.json({ ok: true, tokens: out, engine });
      },
    },
  },
});
