export type Aspect = "original" | "16:9" | "9:16" | "1:1" | "4:5";

export type CaptionMode = "phrase" | "reveal" | "single" | "karaoke" | "stack" | "headline";

/** Second typeface for the hero / accent words (headline looks). */
export type AccentFont = { family: string; weight: number; italic?: boolean; uppercase?: boolean; tracking?: number };

export type CaptionAnimation =
  | "none"
  | "fade"
  | "pop"
  | "rise"
  | "slam"
  | "bounce-drop"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "spin"
  | "blur-in"
  | "rise-blur"
  | "flicker"
  | "elastic"
  | "typewriter"
  | "scatter"
  | "swing"
  | "zoom-out";

export type FitMode = "contain" | "cover" | "blur";

export type Word = {
  id: string;
  text: string;
  start: number;
  end: number;
  emphasis?: boolean;
  breakAfter?: boolean;
  speaker?: number;
};

export type CaptionLook = {
  id: string;
  name: string;
  blurb: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  /** Font size as % of frame width. */
  size: number;
  tracking: number;
  uppercase: boolean;
  color: string;
  highlight: string;
  stroke: string;
  /** Outline thickness, 0–14. */
  strokeWidth: number;
  /** Glow in the highlight colour. */
  shadow: boolean;
  background: string | null;
  backgroundOpacity: number;
  radius: number;
  /** Active word sits in a filled box (highlight) with ink-coloured text. */
  activeFill: boolean;
  align: "left" | "center" | "right";
  /** Vertical centre of the caption block, % of frame height. */
  y: number;
  wordsPerCue: number;
  animation: CaptionAnimation;
  mode: CaptionMode;
  ink: string;
  tag?: string;
  region?: string;
  sample?: string;
  featured?: boolean;
  /** Requires a free Cutline login during the launch period. */
  pro?: boolean;
  /** Animate each word on its own (staggered) instead of the whole line. */
  perWord?: boolean;
  /** Scale of the word being spoken (1 = no change). */
  activeScale?: number;
  /** Opacity of words that are not spoken yet (phrase mode). */
  upcomingAlpha?: number;
  /** Two-stop vertical gradient fill. */
  gradient?: [string, string] | null;
  /** Hard drop shadow (x, y, blur as fraction of font size). */
  dropShadow?: { x: number; y: number; blur: number; color: string } | null;
  /** Stacked 3D extrusion behind the text. */
  extrude?: { depth: number; color: string } | null;
  /** Box behind every word. */
  wordBox?: string | null;
  /** Colour used for emphasised words (defaults to highlight). */
  emphasisColor?: string;
  emphasisScale?: number;
  /** Cycle the active colour through these colours, one per word. */
  palette?: string[];
  glowColor?: string;
  lineHeight?: number;
  /** Max line width, % of frame width. */
  maxWidth?: number;
  // ── Headline looks: small "lead" words around one big "hero" word ("hello and / WELCOME / to the show").
  /** Which word becomes the hero when none in the caption is marked as a key word. */
  heroPick?: "longest" | "shortest" | "tail";
  /** Keep hero words inside the line (accent word) instead of on a line of their own. */
  heroInline?: boolean;
  /** Size of the lead words relative to the base size (hero size = emphasisScale). */
  leadScale?: number;
  leadColor?: string;
  /** Lead line before the hero hugs its left edge, the line after hugs its right edge. */
  edgeAlign?: boolean;
  accentFont?: AccentFont | null;
  accentColor?: string;
  accentGradient?: [string, string] | null;
  /** Glow only around the hero word. */
  accentGlow?: string | null;
  /** Filled box behind the hero word. */
  accentBox?: string | null;
};

export type Cut = { id: string; start: number; end: number };

export type Project = {
  id: string;
  name: string;
  updatedAt: number;
  aspect: Aspect;
  fit?: FitMode;
  words: Word[];
  speakers: Record<string, string>;
  look: CaptionLook;
  guides: boolean;
  mediaName: string | null;
  gradeId: string;
  voice: VoiceMix;
  /** "full" shows every word, "key" shows only emphasised hook words. */
  captionMode?: "full" | "key";
  splits?: number[];
  cuts?: Cut[];
  captionsHidden?: boolean;
  /** When the project was first saved. */
  createdAt?: number;
  /** Length of the attached media in seconds (shown in My Recent Projects). */
  duration?: number | null;
  /** Small JPEG data URL of the first frames, for the projects folder. */
  thumb?: string | null;
};

export const ASPECTS: Record<Aspect, { ratio: number; label: string; w: number; h: number }> = {
  original: { ratio: 9 / 16, label: "Original", w: 1080, h: 1920 },
  "9:16": { ratio: 9 / 16, label: "Reels / TikTok", w: 1080, h: 1920 },
  "16:9": { ratio: 16 / 9, label: "YouTube", w: 1920, h: 1080 },
  "1:1": { ratio: 1, label: "Square", w: 1080, h: 1080 },
  "4:5": { ratio: 4 / 5, label: "Portrait post", w: 1080, h: 1350 },
};

/** Frame ratio for the project, using the media's own shape when the aspect is "original". */
export function frameRatio(aspect: Aspect, media: { width: number; height: number } | null): number {
  if (aspect === "original") {
    if (media && media.width > 0 && media.height > 0) return media.width / media.height;
    return 9 / 16;
  }
  return ASPECTS[aspect].ratio;
}

export const LANGUAGES: { id: string; label: string; hint?: string }[] = [
  { id: "roman-ur", label: "Roman Urdu", hint: "Urdu speech written in English letters" },
  { id: "ur", label: "Urdu (اردو)" },
  { id: "hi", label: "Hindi (हिन्दी)" },
  { id: "roman-hi", label: "Roman Hindi / Hinglish" },
  { id: "en", label: "English" },
  { id: "", label: "Auto detect" },
  { id: "ar", label: "Arabic" },
  { id: "fa", label: "Persian" },
  { id: "pa", label: "Punjabi (as Roman)" },
  { id: "es", label: "Spanish" },
  { id: "pt", label: "Portuguese" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "id", label: "Indonesian" },
  { id: "ms", label: "Malay" },
  { id: "tr", label: "Turkish" },
  { id: "ru", label: "Russian" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "zh", label: "Chinese" },
  { id: "vi", label: "Vietnamese" },
  { id: "th", label: "Thai" },
  { id: "it", label: "Italian" },
];

export const FONTS = [
  "Poppins",
  "Montserrat",
  "Outfit",
  "Anton",
  "Archivo Black",
  "Bangers",
  "Barlow Condensed",
  "Bebas Neue",
  "Bricolage Grotesque",
  "Bungee",
  "Caveat",
  "Cinzel",
  "Dancing Script",
  "Dela Gothic One",
  "Fraunces",
  "Instrument Serif",
  "Kalam",
  "Kanit",
  "Kaushan Script",
  "Lilita One",
  "Luckiest Guy",
  "Noto Nastaliq Urdu",
  "Noto Sans Devanagari",
  "Oswald",
  "Permanent Marker",
  "Playfair Display",
  "Righteous",
  "Russo One",
  "Sora",
  "Space Grotesk",
  "Syne",
  "Titan One",
];

export type VoiceMix = {
  clean: boolean;
  rumble: number;
  presence: number;
  compress: number;
};

export const defaultVoice: VoiceMix = {
  clean: false,
  rumble: 140,
  presence: 3.5,
  compress: 0.55,
};
