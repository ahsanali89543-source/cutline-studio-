/**
 * The one caption painter. The player overlay, template thumbnails and the
 * MP4 export all draw through `drawCaptions`, so what you see while editing is
 * exactly what gets burned into the file.
 */
import type { AccentFont, CaptionAnimation, CaptionLook, Cut, Word } from "@/lib/captions/types";
import { buildCues, inCut, sortWords, type Cue } from "@/lib/captions/timing";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type DrawOptions = {
  /** Show only emphasised words ("key moments" caption mode). */
  keyOnly?: boolean;
  /** Thumbnails: every word of the cue visible, every entrance finished. */
  settle?: boolean;
  /** Removed ranges of the source: their words are never drawn. */
  cuts?: Cut[];
};

type Motion = { x: number; y: number; scale: number; rot: number; alpha: number; blur: number; reveal: number };

const REST: Motion = { x: 0, y: 0, scale: 1, rot: 0, alpha: 1, blur: 0, reveal: 1 };

export const ANIMATIONS: { id: CaptionAnimation; name: string; pro?: boolean }[] = [
  { id: "pop", name: "Pop" },
  { id: "fade", name: "Fade" },
  { id: "rise", name: "Rise" },
  { id: "slam", name: "Slam" },
  { id: "slide-up", name: "Word Slide Up" },
  { id: "slide-down", name: "Slide Down" },
  { id: "slide-left", name: "Glide Left" },
  { id: "slide-right", name: "Glide Right" },
  { id: "typewriter", name: "Typewriter" },
  { id: "bounce-drop", name: "Bounce Drop", pro: true },
  { id: "elastic", name: "Elastic Reveal", pro: true },
  { id: "spin", name: "Wheel Spin", pro: true },
  { id: "blur-in", name: "Blur Hop", pro: true },
  { id: "rise-blur", name: "Rise Blur", pro: true },
  { id: "flicker", name: "Flicker", pro: true },
  { id: "scatter", name: "Scatter Bounce", pro: true },
  { id: "swing", name: "Swing", pro: true },
  { id: "zoom-out", name: "Zoom Punch", pro: true },
  { id: "none", name: "No motion" },
];

const DURATION: Record<CaptionAnimation, number> = {
  none: 0,
  fade: 0.22,
  pop: 0.2,
  rise: 0.24,
  slam: 0.16,
  "bounce-drop": 0.5,
  "slide-up": 0.26,
  "slide-down": 0.26,
  "slide-left": 0.26,
  "slide-right": 0.26,
  spin: 0.38,
  "blur-in": 0.3,
  "rise-blur": 0.32,
  flicker: 0.38,
  elastic: 0.62,
  typewriter: 0.28,
  scatter: 0.42,
  swing: 0.55,
  "zoom-out": 0.24,
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeElastic = (t: number) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
const easeBounce = (t: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return ((value >>> 0) % 1000) / 1000;
}

export function motionAt(animation: CaptionAnimation, elapsed: number, seed = "w"): Motion {
  const duration = DURATION[animation] ?? 0;
  if (!duration || elapsed >= duration) return REST;
  if (elapsed < 0) return { ...REST, alpha: 0 };
  const t = clamp(elapsed / duration);
  const fadeIn = clamp(t * 2.4);
  switch (animation) {
    case "fade":
      return { ...REST, alpha: easeOut(t) };
    case "pop":
      return { ...REST, scale: 0.55 + 0.45 * easeBack(t), alpha: fadeIn };
    case "rise":
      return { ...REST, y: 0.38 * (1 - easeOut(t)), alpha: fadeIn };
    case "slam":
      return { ...REST, scale: 1.55 - 0.55 * easeOut(t), alpha: fadeIn };
    case "bounce-drop":
      return { ...REST, y: -0.9 * (1 - easeBounce(t)), alpha: clamp(t * 5) };
    case "slide-up":
      return { ...REST, y: 0.65 * (1 - easeOut(t)), alpha: fadeIn };
    case "slide-down":
      return { ...REST, y: -0.65 * (1 - easeOut(t)), alpha: fadeIn };
    case "slide-left":
      return { ...REST, x: 0.9 * (1 - easeOut(t)), alpha: fadeIn };
    case "slide-right":
      return { ...REST, x: -0.9 * (1 - easeOut(t)), alpha: fadeIn };
    case "spin":
      return { ...REST, rot: -1.4 * (1 - easeBack(t)), scale: 0.4 + 0.6 * easeBack(t), alpha: fadeIn };
    case "blur-in":
      return { ...REST, blur: 0.28 * (1 - easeOut(t)), scale: 1.12 - 0.12 * easeOut(t), y: -0.12 * Math.sin(t * Math.PI), alpha: fadeIn };
    case "rise-blur":
      return { ...REST, y: 0.45 * (1 - easeOut(t)), blur: 0.22 * (1 - easeOut(t)), alpha: fadeIn };
    case "flicker": {
      const steps = [0, 1, 0.15, 1, 0.45, 1, 0.8, 1];
      return { ...REST, alpha: steps[Math.min(steps.length - 1, Math.floor(t * steps.length))] };
    }
    case "elastic":
      return { ...REST, scale: Math.max(0.01, easeElastic(t)), alpha: clamp(t * 6) };
    case "typewriter":
      return { ...REST, reveal: t };
    case "scatter": {
      const a = hash(seed) * Math.PI * 2;
      const k = 1 - easeBack(t);
      return { ...REST, x: Math.cos(a) * 0.9 * k, y: Math.sin(a) * 0.9 * k, rot: (hash(`${seed}r`) - 0.5) * 0.8 * k, alpha: fadeIn };
    }
    case "swing":
      return { ...REST, rot: 0.5 * Math.exp(-5 * t) * Math.cos(t * 14), alpha: fadeIn };
    case "zoom-out":
      return { ...REST, scale: 2.3 - 1.3 * easeOut(t), alpha: fadeIn };
    default:
      return REST;
  }
}

// ------------------------------------------------------------------ layout

export type CueOptions = {
  /** "Key moments" mode: only emphasised words, one at a time. */
  keyOnly?: boolean;
  /** Removed ranges: words inside them never appear. */
  cuts?: Cut[];
};

export type CaptionPlan = {
  cues: Cue[];
  /** How long a caption may linger after its last word (never into the next one). */
  hold: number;
  mode: CaptionLook["mode"];
};

const planCache = new WeakMap<Word[], Map<string, CaptionPlan>>();

/**
 * The single source of truth for which words are on screen when. The player,
 * the MP4 export and the timeline's caption strip all read this plan, so the
 * timeline can never disagree with the picture.
 */
export function captionPlan(allWords: Word[], look: Pick<CaptionLook, "mode" | "wordsPerCue">, options: CueOptions = {}): CaptionPlan {
  let byKey = planCache.get(allWords);
  if (!byKey) {
    byKey = new Map();
    planCache.set(allWords, byKey);
  }
  const cuts = options.cuts ?? [];
  const mode = options.keyOnly ? "single" : look.mode;
  const key = `${look.wordsPerCue}:${mode}:${options.keyOnly ? 1 : 0}:${cuts.map((cut) => `${cut.start}-${cut.end}`).join(",")}`;
  let plan = byKey.get(key);
  if (!plan) {
    let words = sortWords(allWords);
    if (options.keyOnly) words = words.filter((word) => word.emphasis);
    if (cuts.length) words = words.filter((word) => !inCut(word, cuts));
    const cues =
      mode === "single"
        ? words.map((word) => ({ id: word.id, start: word.start, end: word.end, words: [word] }))
        : buildCues(words, look.wordsPerCue, cuts);
    plan = { cues, hold: options.keyOnly ? 1.1 : mode === "single" ? 0.18 : 0.35, mode };
    byKey.set(key, plan);
  }
  return plan;
}

/** When each caption is actually visible (matches `findCue` exactly). */
export function cueWindows(plan: CaptionPlan): { cue: Cue; start: number; end: number }[] {
  return plan.cues.map((cue, index) => {
    const next = plan.cues[index + 1];
    const gap = next ? next.start - cue.end : Infinity;
    let end = cue.end + Math.max(0.03, Math.min(plan.hold, gap));
    if (next) end = Math.min(end, next.start - 0.02);
    return { cue, start: Math.max(0, cue.start - 0.02), end: Math.max(cue.start, end) };
  });
}

export function findCue(cues: Cue[], time: number, hold: number): Cue | null {
  // Binary search for the last cue starting at or before `time`.
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start - 0.02 <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  const cue = cues[found];
  if (time <= cue.end + 0.03) return cue;
  const next = cues[found + 1];
  const gap = next ? next.start - cue.end : Infinity;
  if (time - cue.end < Math.min(hold, gap)) return cue;
  return null;
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export function displayWord(text: string, uppercase: boolean) {
  return uppercase ? text.toUpperCase() : text;
}

function fontFor(look: CaptionLook, px: number, hero = false) {
  const accent = hero ? look.accentFont : null;
  if (accent) return `${accent.italic ? "italic " : ""}${accent.weight} ${px.toFixed(2)}px "${accent.family}", "${look.fontFamily}", "Noto Nastaliq Urdu", sans-serif`;
  return `${look.italic ? "italic " : ""}${look.fontWeight} ${px.toFixed(2)}px "${look.fontFamily}", "Noto Nastaliq Urdu", sans-serif`;
}

type Item = { word: Word; text: string; px: number; width: number; index: number; hero: boolean };

function setSpacing(ctx: Ctx, look: CaptionLook, px: number, hero = false) {
  const target = ctx as Ctx & { letterSpacing?: string };
  const tracking = hero && look.accentFont ? (look.accentFont.tracking ?? 0) : look.tracking;
  if ("letterSpacing" in target) target.letterSpacing = `${(tracking * px).toFixed(2)}px`;
}

const LIGHT_WORDS = new Set(
  "the a an and or to of in on at is are was it this i you we my hai hain ka ki ke ko se mein main aur bhi to toh ho tha thi ye yeh wo woh is us ek na nahi kya jo ab hi par tak hum aap tum".split(" "),
);

/** Headline looks: which words of the caption are the big hero (key words first, then the look's rule). */
function heroIndexes(words: Word[], look: CaptionLook): Set<number> {
  const marked = words.flatMap((word, index) => (word.emphasis ? [index] : []));
  if (marked.length) return new Set(marked);
  if (words.length <= 1) return new Set([0]);
  if (look.heroPick === "tail") {
    const first = Math.floor(words.length / 2);
    return new Set(words.map((_, index) => index).filter((index) => index >= first));
  }
  const bare = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  let best = -1;
  let bestScore = look.heroPick === "shortest" ? Infinity : -Infinity;
  words.forEach((word, index) => {
    const text = bare(word.text);
    if (!text) return;
    if (look.heroPick === "shortest") {
      // A short joining word ("to", "aur") in an accent script.
      const score = text.length;
      if (score < bestScore) {
        bestScore = score;
        best = index;
      }
      return;
    }
    const score = text.length - (LIGHT_WORDS.has(text) ? 20 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return new Set([best < 0 ? 0 : best]);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, h / 2, w / 2)));
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

// ------------------------------------------------------------------ paint

export function drawCaptions(
  ctx: Ctx,
  allWords: Word[],
  time: number,
  look: CaptionLook,
  W: number,
  H: number,
  options: DrawOptions = {},
) {
  if (!allWords.length) return;
  const plan = captionPlan(allWords, look, options);
  const mode = plan.mode;
  const cue = findCue(plan.cues, time, plan.hold);
  if (!cue) return;

  const basePx = (look.size / 100) * W;
  const lineFactor = look.lineHeight ?? 1.18;
  const maxWidth = ((look.maxWidth ?? 86) / 100) * W;
  // Outlines and boxes eat into the space between words, so widen the gap for them.
  const gap =
    basePx * 0.26 +
    (look.strokeWidth > 0 ? basePx * look.strokeWidth * 0.04 : 0) +
    (look.wordBox || look.activeFill ? basePx * 0.34 : 0) +
    (look.italic ? basePx * 0.04 : 0);
  const rtl = cue.words.some((word) => RTL.test(word.text));

  const headline = mode === "headline";
  const heroes = headline ? heroIndexes(cue.words, look) : null;
  const heroScale = look.emphasisScale ?? (headline ? 1.7 : 1.12);
  const leadScale = look.leadScale ?? 0.58;

  // Measure.
  const items: Item[] = cue.words.map((word, index) => {
    const hero = Boolean(heroes?.has(index));
    let px = basePx;
    if (headline) px *= hero ? heroScale : leadScale;
    else if (word.emphasis) px *= heroScale;
    if (mode === "stack" && !word.emphasis && index % 2 === 1) px *= 0.78;
    const upper = hero && look.accentFont?.uppercase !== undefined ? look.accentFont.uppercase : look.uppercase;
    const text = displayWord(word.text, upper);
    ctx.font = fontFor(look, px, hero);
    setSpacing(ctx, look, px, hero);
    let width = ctx.measureText(text).width;
    // A single word wider than the frame shrinks to fit instead of running off the edge.
    if (width > maxWidth && width > 0) {
      px *= maxWidth / width;
      ctx.font = fontFor(look, px, hero);
      setSpacing(ctx, look, px, hero);
      width = ctx.measureText(text).width;
    }
    return { word, text, px, width, index, hero };
  });
  // Lead words sit closer together than the big hero words.
  const gapBetween = (a: Item, b: Item) => {
    const base = headline ? gap * (Math.min(a.px, b.px) / basePx) : gap;
    // Room for the bubble behind a boxed hero word, only next to that word.
    return look.accentBox && (a.hero || b.hero) ? base + Math.max(a.px, b.px) * 0.3 : base;
  };

  // Wrap into lines.
  const lines: Item[][] = [];
  if (mode === "stack") for (const item of items) lines.push([item]);
  else {
    let current: Item[] = [];
    let width = 0;
    for (const item of items) {
      const prev = current[current.length - 1];
      // Headline: the hero gets a line of its own (unless the look keeps it inline).
      const forced = headline && !look.heroInline && prev && prev.hero !== item.hero;
      const next = width + item.width + (prev ? gapBetween(prev, item) : 0);
      if (prev && (forced || next > maxWidth)) {
        lines.push(current);
        current = [item];
        width = item.width;
      } else {
        current.push(item);
        width = next;
      }
    }
    if (current.length) lines.push(current);
  }
  if (rtl) for (const line of lines) line.reverse();

  const lineHeights = lines.map((line) => Math.max(...line.map((item) => item.px)) * lineFactor);
  const blockHeight = lineHeights.reduce((sum, value) => sum + value, 0);
  let top = (look.y / 100) * H - blockHeight / 2;
  top = Math.max(H * 0.03, Math.min(top, H * 0.97 - blockHeight));

  const totals = lines.map((line) => line.reduce((sum, item, index) => sum + item.width + (index ? gapBetween(line[index - 1], item) : 0), 0));
  const lineXs = totals.map((total) => (look.align === "left" ? W * 0.08 : look.align === "right" ? W * 0.92 - total : (W - total) / 2));
  if (headline && look.edgeAlign && !look.heroInline) {
    // "hello and" hugs the hero's left edge, "to the show" its right edge.
    const heroLines = lines.map((line, index) => (line.some((item) => item.hero) ? index : -1)).filter((index) => index >= 0);
    if (heroLines.length) {
      const firstHero = heroLines[0];
      const lastHero = heroLines[heroLines.length - 1];
      const heroWidth = Math.max(...heroLines.map((index) => totals[index]));
      const heroLeft = Math.min(...heroLines.map((index) => lineXs[index]));
      lines.forEach((_, index) => {
        if (totals[index] >= heroWidth) return;
        if (index < firstHero) lineXs[index] = heroLeft;
        else if (index > lastHero) lineXs[index] = heroLeft + heroWidth - totals[index];
      });
    }
  }

  // Line-level entrance (phrase mode without per-word motion).
  const lineLevel = ((mode === "phrase" || mode === "headline") && !look.perWord) || mode === "karaoke";
  const lineMotion = !options.settle && lineLevel ? motionAt(look.animation, time - cue.start, cue.id) : REST;
  const stagger = Math.min(0.08, Math.max(0.03, (cue.end - cue.start) / Math.max(1, cue.words.length) / 2));
  const blockCenterY = top + blockHeight / 2;
  const blockCenterX = look.align === "left" ? W * 0.08 + maxWidth / 2 : look.align === "right" ? W * 0.92 - maxWidth / 2 : W / 2;

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  if (lineMotion !== REST) {
    ctx.globalAlpha = lineMotion.alpha;
    ctx.translate(blockCenterX + lineMotion.x * basePx, blockCenterY + lineMotion.y * basePx);
    ctx.rotate(lineMotion.rot);
    ctx.scale(lineMotion.scale, lineMotion.scale);
    ctx.translate(-blockCenterX, -blockCenterY);
    if (lineMotion.blur > 0.002 && "filter" in ctx) ctx.filter = `blur(${(lineMotion.blur * basePx).toFixed(1)}px)`;
  }

  let y = top;
  lines.forEach((line, lineIndex) => {
    const lh = lineHeights[lineIndex];
    const cy = y + lh / 2;
    const total = totals[lineIndex];
    let x = lineXs[lineIndex];

    if (look.background) {
      const padX = basePx * 0.42;
      const padY = basePx * 0.16;
      ctx.save();
      ctx.globalAlpha *= look.backgroundOpacity;
      ctx.fillStyle = look.background;
      roundRect(ctx, x - padX, cy - lh / 2 - padY * 0.2, total + padX * 2, lh + padY * 0.4, look.radius);
      ctx.restore();
    }

    line.forEach((item, itemIndex) => {
      const word = item.word;
      const step = item.width + (itemIndex < line.length - 1 ? gapBetween(item, line[itemIndex + 1]) : 0);
      const visibleFrom =
        mode === "reveal" || mode === "stack" || mode === "single"
          ? word.start - 0.02
          : (mode === "phrase" || mode === "headline") && look.perWord
            ? cue.start + item.index * stagger
            : cue.start;
      if (!options.settle && time < visibleFrom) {
        x += step;
        return;
      }
      const motion = options.settle || lineLevel ? REST : motionAt(look.animation, time - visibleFrom, word.id);
      const active = time >= word.start && time < word.end;
      const spoken = time >= word.start;
      paintWord(ctx, look, item, x, cy, time, { active, spoken, motion, mode, settle: Boolean(options.settle) });
      x += step;
    });
    y += lh;
  });
  ctx.restore();
}

function paintWord(
  ctx: Ctx,
  look: CaptionLook,
  item: Item,
  x: number,
  cy: number,
  time: number,
  state: { active: boolean; spoken: boolean; motion: Motion; mode: string; settle: boolean },
) {
  const { word, px, width } = item;
  const { active, motion, mode } = state;
  const headline = mode === "headline";
  const hero = headline && item.hero;
  const hot = headline ? hero : active || Boolean(word.emphasis);
  const palette = look.palette?.length ? look.palette[item.index % look.palette.length] : null;
  const hotColor = hero
    ? (look.accentColor ?? look.emphasisColor ?? look.highlight)
    : word.emphasis && !active
      ? (look.emphasisColor ?? look.highlight)
      : (palette ?? look.highlight);

  let scale = motion.scale;
  if (active && (look.activeScale ?? 1) !== 1 && mode !== "karaoke") {
    const pulse = state.settle ? 1 : easeBack(clamp((time - word.start) / 0.14));
    scale *= 1 + ((look.activeScale ?? 1) - 1) * pulse;
  }
  let alpha = motion.alpha;
  if ((mode === "phrase" || headline) && !state.spoken && !state.settle) alpha *= look.upcomingAlpha ?? 1;
  if (mode === "karaoke" && !state.spoken) alpha *= 0.55;
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + width / 2 + motion.x * px, cy + motion.y * px);
  if (motion.rot) ctx.rotate(motion.rot);
  if (scale !== 1) ctx.scale(scale, scale);
  if (motion.blur > 0.002 && "filter" in ctx) ctx.filter = `blur(${(motion.blur * px).toFixed(1)}px)`;
  ctx.font = fontFor(look, px, item.hero);
  setSpacing(ctx, look, px, item.hero);
  if (RTL.test(item.text)) ctx.direction = "rtl";

  const left = -width / 2;
  let text = item.text;
  if (motion.reveal < 1) {
    const chars = Array.from(text);
    text = chars.slice(0, Math.max(0, Math.ceil(chars.length * motion.reveal))).join("");
    if (!text) {
      ctx.restore();
      return;
    }
  }
  const drawX = ctx.direction === "rtl" ? -left : left;
  if (ctx.direction === "rtl") ctx.textAlign = "right";

  // Boxes.
  const accentBox = hero && look.accentBox ? look.accentBox : null;
  const fillBox = Boolean(accentBox) || (look.activeFill && (headline ? active : hot));
  if (look.wordBox || fillBox) {
    ctx.save();
    ctx.fillStyle = accentBox ?? (fillBox ? (headline ? look.highlight : hotColor) : (look.wordBox as string));
    const padX = px * 0.16;
    roundRect(ctx, left - padX, -px * 0.56, width + padX * 2, px * 1.1, Math.min(look.radius, px * 0.3));
    ctx.restore();
  }

  const strokeW = look.strokeWidth > 0 && !fillBox ? px * look.strokeWidth * 0.04 : 0;

  // 3D extrusion.
  if (look.extrude && look.extrude.depth > 0 && !fillBox) {
    ctx.save();
    ctx.fillStyle = look.extrude.color;
    ctx.strokeStyle = look.extrude.color;
    ctx.lineWidth = strokeW;
    const steps = Math.max(1, Math.round(look.extrude.depth));
    const step = px * 0.018;
    for (let index = steps; index >= 1; index -= 1) {
      if (strokeW) ctx.strokeText(text, drawX + index * step, index * step);
      ctx.fillText(text, drawX + index * step, index * step);
    }
    ctx.restore();
  }

  // Drop shadow sits under the outline.
  if (look.dropShadow && !fillBox) {
    ctx.save();
    ctx.shadowColor = look.dropShadow.color;
    ctx.shadowOffsetX = look.dropShadow.x * px;
    ctx.shadowOffsetY = look.dropShadow.y * px;
    ctx.shadowBlur = look.dropShadow.blur * px;
    ctx.fillStyle = look.dropShadow.color;
    if (strokeW) {
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = look.stroke;
      ctx.strokeText(text, drawX, 0);
    } else ctx.fillText(text, drawX, 0);
    ctx.restore();
  }

  if (strokeW) {
    ctx.save();
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = look.stroke;
    const glow = hero && look.accentGlow ? look.accentGlow : look.shadow ? (look.glowColor ?? (hot ? hotColor : look.highlight)) : null;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = px * (hero && look.accentGlow ? 0.45 : 0.32);
    }
    ctx.strokeText(text, drawX, 0);
    ctx.restore();
  }

  // Fill colour.
  let fill: string | CanvasGradient = headline ? (look.leadColor ?? look.color) : look.color;
  if (fillBox) fill = look.ink;
  else if (hero && look.accentGradient) {
    const gradient = ctx.createLinearGradient(0, -px * 0.5, 0, px * 0.5);
    gradient.addColorStop(0, look.accentGradient[0]);
    gradient.addColorStop(1, look.accentGradient[1]);
    fill = gradient;
  } else if (headline) fill = hero ? hotColor : active && !state.settle ? look.highlight : (look.leadColor ?? look.color);
  else if (mode === "karaoke") fill = state.spoken && !active ? look.highlight : look.color;
  else if (hot) fill = hotColor;
  else if (look.gradient) {
    const gradient = ctx.createLinearGradient(0, -px * 0.5, 0, px * 0.5);
    gradient.addColorStop(0, look.gradient[0]);
    gradient.addColorStop(1, look.gradient[1]);
    fill = gradient;
  }
  if (!headline && hot && look.gradient && !fillBox && mode !== "karaoke" && !palette && !word.emphasis) {
    // Gradient looks keep their gradient but brighten to the highlight on the spoken word.
    fill = hotColor;
  }

  ctx.save();
  if (!strokeW && !fillBox) {
    const glow = hero && look.accentGlow ? look.accentGlow : look.shadow ? (look.glowColor ?? (hot ? hotColor : look.highlight)) : null;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = px * (hero && look.accentGlow ? 0.5 : 0.38);
    }
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, drawX, 0);
  ctx.restore();

  // Karaoke: sweep the highlight across the word being sung.
  if (mode === "karaoke" && active) {
    const progress = clamp((time - word.start) / Math.max(0.05, word.end - word.start));
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - px * 0.2, -px, (width + px * 0.4) * progress, px * 2);
    ctx.clip();
    ctx.fillStyle = look.highlight;
    if (look.shadow) {
      ctx.shadowColor = look.highlight;
      ctx.shadowBlur = px * 0.4;
    }
    ctx.fillText(text, drawX, 0);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ fonts

const fontPromises = new Map<string, Promise<void>>();

type FontNeeds = Pick<CaptionLook, "fontFamily" | "fontWeight" | "italic"> & { accentFont?: AccentFont | null };

function fontSpecs(look: FontNeeds): string[] {
  const specs = [`${look.italic ? "italic " : ""}${look.fontWeight} 48px "${look.fontFamily}"`];
  const accent = look.accentFont;
  if (accent) specs.push(`${accent.italic ? "italic " : ""}${accent.weight} 48px "${accent.family}"`);
  return specs;
}

/** Load the look's typeface (and its accent typeface) before drawing. */
export function ensureFont(look: FontNeeds): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.all(
    fontSpecs(look).map((spec) => {
      let promise = fontPromises.get(spec);
      if (!promise) {
        promise = document.fonts
          .load(spec, "AaBb اردو")
          .then(() => undefined)
          .catch(() => undefined);
        fontPromises.set(spec, promise);
      }
      return promise;
    }),
  ).then(() => undefined);
}

export function fontReady(look: FontNeeds): boolean {
  if (typeof document === "undefined" || !document.fonts) return true;
  try {
    return fontSpecs(look).every((spec) => document.fonts.check(spec));
  } catch {
    return true;
  }
}
