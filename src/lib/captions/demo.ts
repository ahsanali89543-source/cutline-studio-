import { templateById } from "@/lib/captions/templates";
import { defaultVoice, type Project, type Word } from "@/lib/captions/types";
import { round, uid } from "@/lib/captions/timing";

const SCRIPT =
  "Assalam o alaikum dosto! Aaj main aapko dikhaunga ke videos par aise captions kaise lagate hain. Bas video upload karo, Transcribe dabao, aur apna style choose karo. Itna asaan hai!";

function timed(text: string): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  let cursor = 0.3;
  return tokens.map((token) => {
    const letters = token.replace(/[^\p{L}\p{N}]/gu, "").length || 1;
    const dur = Math.min(0.62, Math.max(0.18, letters * 0.05 + 0.1));
    const word: Word = { id: uid(), text: token, start: round(cursor), end: round(cursor + dur) };
    cursor += dur + (/[.!?,]$/.test(token) ? 0.26 : 0.05);
    return word;
  });
}

export function demoProject(): Project {
  const words = timed(SCRIPT);
  for (const word of words) {
    if (/^(captions|Transcribe|style|asaan)/i.test(word.text)) word.emphasis = true;
    if (/[.!?]$/.test(word.text)) word.breakAfter = true;
  }
  return {
    id: "demo",
    name: "Demo reel",
    updatedAt: Date.now(),
    aspect: "9:16",
    fit: "blur",
    words,
    speakers: { "0": "Narrator" },
    look: templateById("roman-classic") ?? templateById("clean-pop")!,
    guides: false,
    mediaName: null,
    gradeId: "neutral",
    voice: { ...defaultVoice },
    captionMode: "full",
    splits: [],
    cuts: [],
  };
}

export const heroLine = timed("Har lafz waqt par. Har reel viral.");
