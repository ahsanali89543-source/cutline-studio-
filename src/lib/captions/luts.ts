export type Lut = {
  id: string;
  name: string;
  blurb: string;
  filter: string;
  wash: string | null;
  washOpacity: number;
  tone: "Film" | "Social" | "Night" | "Drama";
};

export const luts: Lut[] = [
  { id: "neutral", name: "Neutral", blurb: "Picture as shot", filter: "none", wash: null, washOpacity: 0, tone: "Film" },
  { id: "teal-orange", name: "Teal & Orange", blurb: "Blockbuster skin and shadows", filter: "contrast(1.12) saturate(1.28) sepia(0.12)", wash: "#06343a", washOpacity: 0.28, tone: "Film" },
  { id: "portra", name: "Portra Warm", blurb: "Soft highlight, peach skin", filter: "contrast(0.96) saturate(1.08) sepia(0.22) brightness(1.04)", wash: "#c47a45", washOpacity: 0.12, tone: "Film" },
  { id: "fuji-400", name: "Fuji 400", blurb: "Cool greens, gentle fade", filter: "contrast(0.94) saturate(0.9) brightness(1.06)", wash: "#1d4d45", washOpacity: 0.16, tone: "Film" },
  { id: "bleach", name: "Bleach Bypass", blurb: "Silver contrast, drained color", filter: "contrast(1.28) saturate(0.45) brightness(1.02)", wash: "#1a1a1a", washOpacity: 0.12, tone: "Film" },
  { id: "noir", name: "Noir", blurb: "Near monochrome, hard blacks", filter: "grayscale(1) contrast(1.25) brightness(0.96)", wash: null, washOpacity: 0, tone: "Night" },
  { id: "moon", name: "Moonlight", blurb: "Blue night, lifted blacks", filter: "saturate(0.7) contrast(1.05) brightness(0.92) hue-rotate(190deg)", wash: "#0b1c33", washOpacity: 0.28, tone: "Night" },
  { id: "golden", name: "Golden Hour", blurb: "Late sun on faces", filter: "sepia(0.35) saturate(1.2) contrast(1.05) brightness(1.05)", wash: "#e6b04a", washOpacity: 0.14, tone: "Social" },
  { id: "desert", name: "Desert", blurb: "Dust, heat, low saturation", filter: "sepia(0.45) saturate(0.85) contrast(1.08)", wash: "#8a5a32", washOpacity: 0.16, tone: "Drama" },
  { id: "bollywood", name: "Bollywood", blurb: "Rich skin, saturated costume", filter: "saturate(1.45) contrast(1.08) brightness(1.03)", wash: "#7a1f2b", washOpacity: 0.1, tone: "Drama" },
  { id: "drama", name: "Urdu Drama", blurb: "Warm lamps, soft contrast", filter: "sepia(0.2) contrast(0.98) saturate(1.05) brightness(1.02)", wash: "#5c3b2e", washOpacity: 0.18, tone: "Drama" },
  { id: "news", name: "Newsroom", blurb: "Clean, slightly cool", filter: "saturate(0.92) contrast(1.06) brightness(1.04)", wash: "#102033", washOpacity: 0.1, tone: "Social" },
  { id: "wedding", name: "Wedding Film", blurb: "Airy highlights, blush", filter: "contrast(0.92) brightness(1.08) saturate(0.95) sepia(0.12)", wash: "#f3c7c2", washOpacity: 0.12, tone: "Film" },
  { id: "night-city", name: "Night City", blurb: "Teal streets, magenta signs", filter: "contrast(1.18) saturate(1.35) hue-rotate(-10deg)", wash: "#2a0a3a", washOpacity: 0.2, tone: "Night" },
  { id: "chrome", name: "Chrome", blurb: "Hard social contrast", filter: "contrast(1.35) saturate(1.15) brightness(0.98)", wash: null, washOpacity: 0, tone: "Social" },
  { id: "fade", name: "Matte Fade", blurb: "Lifted blacks, muted", filter: "contrast(0.88) saturate(0.8) brightness(1.06)", wash: "#2a261f", washOpacity: 0.14, tone: "Film" },
  { id: "emerald", name: "Emerald", blurb: "Forest grade for travel", filter: "saturate(1.1) hue-rotate(18deg) contrast(1.05)", wash: "#0e3b2e", washOpacity: 0.18, tone: "Social" },
  { id: "rose", name: "Rose Gold", blurb: "Beauty light, pink midtones", filter: "sepia(0.18) saturate(1.12) brightness(1.06)", wash: "#c47a8a", washOpacity: 0.16, tone: "Social" },
  { id: "ice", name: "Ice", blurb: "Cold product shots", filter: "saturate(0.75) contrast(1.1) brightness(1.08) hue-rotate(170deg)", wash: "#9fd4e8", washOpacity: 0.12, tone: "Night" },
  { id: "vintage", name: "1978", blurb: "Yellowed print, soft grain look", filter: "sepia(0.55) contrast(0.95) saturate(0.8)", wash: "#6b4a28", washOpacity: 0.12, tone: "Film" },
  { id: "punch", name: "Punch Social", blurb: "Reels contrast, vivid", filter: "contrast(1.2) saturate(1.5) brightness(1.02)", wash: "#ff5a1f", washOpacity: 0.08, tone: "Social" },
  { id: "olive", name: "Olive", blurb: "Military documentary", filter: "sepia(0.25) saturate(0.7) hue-rotate(30deg) contrast(1.1)", wash: "#3d4a28", washOpacity: 0.18, tone: "Drama" },
  { id: "candle", name: "Candle", blurb: "Interior night, amber only", filter: "sepia(0.48) saturate(1.05) brightness(0.94) contrast(1.06)", wash: "#e6b04a", washOpacity: 0.16, tone: "Drama" },
  { id: "mono-gold", name: "Mono Gold", blurb: "Black and white with a gold wash", filter: "grayscale(1) contrast(1.15)", wash: "#e6b04a", washOpacity: 0.2, tone: "Film" },
  { id: "haze", name: "Haze", blurb: "Foggy morning, low contrast", filter: "contrast(0.82) brightness(1.1) saturate(0.7)", wash: "#c5d0d6", washOpacity: 0.16, tone: "Film" },
  { id: "crimson", name: "Crimson", blurb: "Thriller reds", filter: "contrast(1.15) saturate(1.2) hue-rotate(-12deg)", wash: "#6b1020", washOpacity: 0.22, tone: "Drama" },
  { id: "pastel", name: "Pastel Day", blurb: "Soft creator look", filter: "saturate(0.85) contrast(0.94) brightness(1.08)", wash: "#f6d7c8", washOpacity: 0.14, tone: "Social" },
  { id: "steel", name: "Steel", blurb: "Interview grade, neutral cool", filter: "saturate(0.65) contrast(1.08) hue-rotate(190deg)", wash: "#243040", washOpacity: 0.16, tone: "Film" },
];

export function lutById(id: string | undefined): Lut {
  return luts.find((item) => item.id === id) ?? luts[0];
}

export const lutTones = ["All", "Film", "Social", "Night", "Drama"] as const;
