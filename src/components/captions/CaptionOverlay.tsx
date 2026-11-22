import { drawCaptions, ensureFont } from "@/lib/captions/render";
import { sampleWords } from "@/lib/captions/templates";
import type { CaptionLook, Cut, Word } from "@/lib/captions/types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Props = {
  words: Word[];
  time: number;
  look: CaptionLook;
  keyOnly?: boolean;
  settle?: boolean;
  /** Removed ranges: their words are never drawn. */
  cuts?: Cut[];
  className?: string;
};

/** Canvas caption layer that fills its (relatively positioned) parent. */
export function CaptionOverlay({ words, time, look, keyOnly, settle, cuts, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fontTick, setFontTick] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    // Layout size (not getBoundingClientRect): 3D-tilted parents must not skew the canvas.
    const apply = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const { fontFamily, fontWeight, italic, accentFont } = look;
  const accentFamily = accentFont?.family;
  const accentWeight = accentFont?.weight;
  const accentItalic = accentFont?.italic;
  useEffect(() => {
    let alive = true;
    const accent = accentFamily ? { family: accentFamily, weight: accentWeight ?? 400, italic: accentItalic } : null;
    void ensureFont({ fontFamily, fontWeight, italic, accentFont: accent }).then(() => {
      if (alive) setFontTick((value) => value + 1);
    });
    return () => {
      alive = false;
    };
  }, [fontFamily, fontWeight, italic, accentFamily, accentWeight, accentItalic]);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(size.w * dpr);
    const h = Math.round(size.h * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawCaptions(ctx, words, time, look, w, h, { keyOnly, settle, cuts });
  }, [words, time, look, size, fontTick, keyOnly, settle, cuts]);

  return <canvas ref={ref} aria-hidden className={className ?? "pointer-events-none absolute inset-0 h-full w-full"} />;
}

/** Template preview: settled frame at rest, live animation while hovered. */
export function TemplateThumb({
  look,
  sample,
  playing,
}: {
  look: CaptionLook;
  sample?: string;
  playing?: boolean;
}) {
  const words = useMemo(() => sampleWords(sample ?? look.sample), [sample, look.sample]);
  // Rest frame: second word for line looks; the longest word for one-word looks.
  const restIndex =
    look.mode === "single"
      ? words.reduce((best, word, index) => (word.text.length > (words[best]?.text.length ?? 0) ? index : best), 0)
      : Math.min(1, words.length - 1);
  const restTime = (words[restIndex]?.start ?? 0.4) + 0.12;
  const [time, setTime] = useState(restTime);
  const loop = (words[words.length - 1]?.end ?? 1) + 0.9;

  useEffect(() => {
    if (!playing) {
      setTime(restTime);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      setTime(((now - began) / 1000) % loop);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, loop, restTime]);

  return <CaptionOverlay words={words} time={time} look={look} settle={!playing} />;
}
