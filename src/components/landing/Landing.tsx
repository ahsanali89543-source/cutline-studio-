import { CaptionOverlay, TemplateThumb } from "@/components/captions/CaptionOverlay";
import { SiteFrame } from "@/components/site/Shell";
import { buttonStyles } from "@/components/ui/button";
import { LAUNCH_FREE_LABEL, useAccount, useIsMember } from "@/lib/account";
import { ANIMATIONS } from "@/lib/captions/render";
import { proCount, templateById, templates } from "@/lib/captions/templates";
import { round } from "@/lib/captions/timing";
import type { CaptionAnimation, CaptionLook, Word } from "@/lib/captions/types";
import { Link } from "@tanstack/react-router";
import {
  AudioLines,
  Check,
  ChevronDown,
  Clapperboard,
  Crown,
  Download,
  FileText,
  Languages,
  Layers,
  Lock,
  Palette,
  ScanFace,
  Scissors,
  Sparkles,
  Star,
  Upload,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function timedWords(text: string, start = 0.2, pace = 0.36): Word[] {
  let cursor = start;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((token, index) => {
      const dur = Math.max(0.22, Math.min(0.5, token.length * 0.05 + 0.12));
      const word: Word = {
        id: `w${index}-${token}`,
        text: token.replace(/\*/g, ""),
        start: round(cursor),
        end: round(cursor + dur),
        emphasis: token.includes("*"),
        breakAfter: /[.!?]$/.test(token),
      };
      cursor += Math.max(dur, pace) + (/[.!?,]$/.test(token) ? 0.2 : 0.03);
      return word;
    });
}

function useLoopTime(length: number, running = true) {
  const [time, setTime] = useState(0.6);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      setTime(((now - began) / 1000) % length);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [length, running]);
  return time;
}

const HERO_SCRIPT = "Assalam o alaikum *dosto!* Aaj main aapko dikhaunga apni *videos* ko *viral* kaise banate hain. Bas upload karo aur *captions* ready!";

export function Landing() {
  return (
    <SiteFrame>
      <Hero />
      <TemplateMarquee />
      <Features />
      <MotionPicker />
      <LanguagesSection />
      <Modes />
      <Gallery />
      <Steps />
      <Pricing />
      <Faq />
      <FinalCta />
    </SiteFrame>
  );
}

// ───────────────────────────────────────────────────────────── hero

function Hero() {
  const words = useMemo(() => timedWords(HERO_SCRIPT), []);
  const loop = (words[words.length - 1]?.end ?? 6) + 1.2;
  const time = useLoopTime(loop);
  const look = templateById("hustle-box") ?? templates[0];
  const spoken = words.filter((word) => word.start <= time).slice(-5);
  return (
    <section className="relative overflow-hidden">
      <div className="aurora">
        <span />
        <span />
        <span />
      </div>
      <div className="grid-floor pointer-events-none absolute inset-x-0 bottom-0 h-[45%] opacity-60" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
        <div className="fade-up">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-brand">
              <Sparkles className="size-3 text-white" />
            </span>
            AI transcript studio · built for Roman Urdu
          </span>
          <h1 className="mt-6 font-display text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-7xl">
            Captions that
            <br />
            speak <span className="text-gradient">Roman Urdu.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Upload a reel, press Transcribe, and every word lands on screen exactly when it's spoken — animated in the styles today's top creators use.
            Then export a crisp MP4.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/studio" search={{ upload: "1" }} className={buttonStyles({ tone: "primary", size: "lg", className: "shine rounded-full px-7" })}>
              <Upload className="size-5" /> Upload a video — free
            </Link>
            <Link to="/captions" className={buttonStyles({ tone: "line", size: "lg", className: "rounded-full" })}>
              Browse {templates.length} templates
            </Link>
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["35+", "languages"],
              [`${templates.length}`, "caption styles"],
              ["Word", "level timing"],
              ["MP4", "· SRT · VTT"],
            ].map(([big, small]) => (
              <div key={small} className="glass rounded-2xl px-3 py-3">
                <dt className="font-display text-2xl font-extrabold text-gradient">{big}</dt>
                <dd className="text-xs text-muted">{small}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="stage-3d relative mx-auto h-[600px] w-full max-w-[520px]">
          <div className="phone-3d absolute top-1/2 left-1/2 h-[540px] w-[290px] -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-full w-full rounded-[44px] bg-gradient-to-b from-zinc-700 to-zinc-900 p-[10px] shadow-[0_60px_120px_-30px_rgba(139,92,246,0.65),0_0_0_1px_rgba(255,255,255,0.08)]">
              <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-black" style={{ containerType: "size" }}>
                <img src="/media/talk.jpg" alt="Creator talking to camera" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
                <CaptionOverlay words={words} time={time} look={{ ...look, size: 7.4, y: 68, maxWidth: 84 }} />
                <div className="absolute top-3 left-1/2 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
                <div className="absolute right-3 bottom-4 left-3 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                    <div className="h-full bg-white" style={{ width: `${(time / loop) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="chip-3d glass absolute top-10 -left-2 w-56 rounded-2xl p-3 shadow-2xl sm:-left-8">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-2">
              <Sparkles className="size-3.5" /> Transcribing · Roman Urdu
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[11px]">
              {spoken.map((word) => (
                <li key={word.id} className="flex justify-between gap-2">
                  <span className="text-muted">{word.start.toFixed(2)}s</span>
                  <span className={word.emphasis ? "font-semibold text-yellow-300" : "text-fg"}>{word.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="chip-3d glass absolute right-0 bottom-24 w-52 rounded-2xl p-3 shadow-2xl sm:-right-6" style={{ animationDelay: "-2.5s" }}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold">
              <AudioLines className="size-3.5 text-accent" /> Voice track
            </p>
            <div className="mt-2 flex h-10 items-center gap-[3px]">
              {Array.from({ length: 26 }, (_, index) => (
                <span
                  key={index}
                  className="wave-bar w-1 rounded-full bg-gradient-to-t from-violet-500 to-cyan-300"
                  style={{ height: `${30 + ((index * 53) % 70)}%`, animationDelay: `${(index % 7) * 0.1}s` }}
                />
              ))}
            </div>
          </div>

          <div className="chip-3d absolute top-24 right-2 rounded-2xl bg-brand-hot px-3 py-2 text-xs font-bold text-white shadow-2xl sm:-right-4" style={{ animationDelay: "-4s" }}>
            ✦ Word-level timing
          </div>
          <div className="chip-3d glass absolute bottom-6 left-4 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs shadow-2xl" style={{ animationDelay: "-1.2s" }}>
            <Download className="size-4 text-accent-2" /> MP4 · 1080×1920 · H.264
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── marquee

function TemplateMarquee() {
  const row = templates.slice(0, 16);
  return (
    <section className="relative border-y border-white/5 bg-surface/40 py-6">
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="marquee flex w-max gap-3">
          {[...row, ...row].map((template, index) => (
            <Link
              key={`${template.id}-${index}`}
              to="/studio"
              search={{ template: template.id }}
              className="relative h-24 w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(160deg,#27272a,#0b0b12)]"
            >
              <TemplateThumb look={template} />
              {template.pro ? <span className="pro-badge absolute top-1.5 right-1.5 rounded px-1 py-0.5 text-[9px]">PRO</span> : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── features

const FEATURES = [
  { icon: Sparkles, title: "AI transcription for Roman Urdu", body: "Speech is transcribed in Urdu first, then written in natural Roman Urdu — 'kya haal hai', not gibberish. English words stay English.", wide: true },
  { icon: Clapperboard, title: "After Effects-style motion", body: `${ANIMATIONS.length - 1} entrance animations: bounce drop, wheel spin, blur hop, typewriter and more.` },
  { icon: Layers, title: "Pro timeline", body: "Caption, video and audio tracks. Drag words, trim edges, split and cut clips, zoom to the frame." },
  { icon: Download, title: "MP4 in original quality", body: "Export the same size you uploaded, or 1080p / 720p. H.264 + AAC that plays everywhere.", wide: true },
  { icon: FileText, title: "SRT & VTT for editors", body: "Drop word-level or line SRTs straight into Premiere Pro, DaVinci Resolve or CapCut." },
  { icon: Star, title: "Emphasis on chosen words", body: "Star the punchline — it grows, changes colour and hits harder." },
  { icon: Palette, title: "Film colour grades", body: "Teal & orange, Portra, night city — previewed live and burned into the export." },
  { icon: Users, title: "Speaker detection", body: "Podcasts and interviews get a label per speaker you can rename." },
  { icon: Scissors, title: "Audio extract", body: "Pull the original soundtrack out as M4A or WAV in one click." },
  { icon: ScanFace, title: "Private by design", body: "Your video never leaves the browser. Only compact audio is sent to transcribe." },
];

function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 py-24">
      <SectionHead kicker="Features" title={<>After Effects-style captions, <span className="text-gradient">without After Effects.</span></>} body="Everything a short-form editor needs to caption, style and ship — in one browser tab." />
      <div className="mt-12 grid gap-4 md:grid-cols-4">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className={`group relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 transition hover:-translate-y-1 hover:border-accent/40 ${feature.wide ? "md:col-span-2" : ""}`}
          >
            <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-accent/20 opacity-0 blur-3xl transition group-hover:opacity-100" />
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand shadow-[0_10px_30px_-10px_rgba(139,92,246,0.9)]">
              <feature.icon className="size-5 text-white" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted">{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── motion picker

function MotionPicker() {
  const [pick, setPick] = useState<CaptionAnimation>("bounce-drop");
  const words = useMemo(() => timedWords("Har lafz apne waqt par screen par aata hai", 0.2, 0.42), []);
  const loop = (words[words.length - 1]?.end ?? 4) + 1;
  const time = useLoopTime(loop);
  const base = templateById("bounce-trend") ?? templates[0];
  const look: CaptionLook = { ...base, animation: pick, mode: "reveal", palette: undefined, size: 9, y: 50 };
  return (
    <section className="relative border-y border-white/5 bg-surface/30">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 lg:grid-cols-2">
        <div>
          <SectionHead
            align="left"
            kicker="Motion"
            title={<>Pick a motion. <span className="text-gradient-hot">Watch it land.</span></>}
            body="Every preset is tuned to the beat of speech: words enter as they're spoken, not before."
          />
          <div className="mt-8 flex flex-wrap gap-2">
            {ANIMATIONS.filter((item) => item.id !== "none").map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPick(item.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition ${pick === item.id ? "border-transparent bg-brand text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.9)]" : "border-line text-muted hover:text-fg"}`}
              >
                {item.name}
                {item.pro ? <Crown className="size-3 text-pro" /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="stage-3d mx-auto">
          <div className="phone-3d relative h-[460px] w-[260px] rounded-[40px] bg-gradient-to-b from-zinc-700 to-zinc-900 p-[9px] shadow-[0_50px_100px_-30px_rgba(236,72,153,0.5)]" style={{ animationDelay: "-3s" }}>
            <div className="relative h-full w-full overflow-hidden rounded-[32px]">
              <img src="/media/stage.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/35" />
              <CaptionOverlay words={words} time={time} look={look} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── languages

const LANGS = [
  "Roman Urdu", "Urdu", "Hindi", "Hinglish", "English", "Arabic", "Persian", "Punjabi (Roman)", "Spanish", "Portuguese", "French", "German",
  "Italian", "Turkish", "Indonesian", "Malay", "Russian", "Ukrainian", "Polish", "Dutch", "Swedish", "Danish", "Finnish", "Norwegian",
  "Greek", "Czech", "Romanian", "Hungarian", "Bulgarian", "Japanese", "Korean", "Chinese", "Cantonese", "Vietnamese", "Thai", "Filipino",
];

function LanguagesSection() {
  return (
    <section id="languages" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 py-24">
      <SectionHead kicker="Languages" title={<>Speak the way <span className="text-gradient">you actually speak.</span></>} body="Most caption apps force Urdu into Hindi script or broken English. Cutline writes it the way your audience reads it." />
      <div className="mt-12 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="gradient-border relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-accent-3/25 blur-3xl" />
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-accent-2 uppercase">
            <Languages className="size-4" /> Roman Urdu engine
          </p>
          <ol className="mt-6 space-y-4">
            <li className="flex items-center gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-sm font-bold">1</span>
              <div className="flex h-10 flex-1 items-center gap-[3px] rounded-xl bg-black/30 px-3">
                {Array.from({ length: 40 }, (_, index) => (
                  <span key={index} className="wave-bar w-1 rounded-full bg-gradient-to-t from-violet-500 to-cyan-300" style={{ height: `${25 + ((index * 41) % 70)}%`, animationDelay: `${(index % 9) * 0.09}s` }} />
                ))}
              </div>
            </li>
            <li className="flex items-center gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-sm font-bold">2</span>
              <p className="flex-1 rounded-xl bg-black/30 px-4 py-2 text-right text-lg" dir="rtl" style={{ fontFamily: '"Noto Nastaliq Urdu", serif' }}>
                آج میں آپ کو بتاؤں گا یہ ویڈیو کیسے بنی
              </p>
            </li>
            <li className="flex items-center gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold text-white">3</span>
              <p className="flex-1 rounded-xl bg-black/30 px-4 py-2 font-display text-xl font-bold">
                aaj main aapko bataunga yeh <span className="text-yellow-300">video</span> kaise bani
              </p>
            </li>
          </ol>
          <p className="mt-6 text-sm text-muted">
            Voice → precise Urdu transcript with word timings → AI rewrites each word in Roman Urdu, keeping English words like video, channel and offer in English.
          </p>
        </div>
        <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-6">
          <p className="text-sm font-semibold">35+ languages, auto-detected</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {LANGS.map((lang, index) => (
              <span key={lang} className={`rounded-full px-2.5 py-1 text-xs ${index < 4 ? "bg-brand text-white" : "border border-line text-muted"}`}>
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── modes

function Modes() {
  const words = useMemo(() => timedWords("Yeh *ek* cheez aapki *zindagi* badal degi bas *dhyan* se suno", 0.2, 0.4), []);
  const loop = (words[words.length - 1]?.end ?? 4) + 1;
  const time = useLoopTime(loop);
  const full = templateById("ghost-reveal") ?? templates[0];
  const key = templateById("viral-yellow") ?? templates[0];
  return (
    <section className="border-y border-white/5 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-24">
        <SectionHead kicker="Two caption modes" title={<>Every word — or <span className="text-gradient-hot">just the hooks.</span></>} body="Switch with one click. Key moments shows only the words you star (or let AI pick them)." />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[
            { title: "Full captions", body: "Every word, timed to speech. Best for talking heads and podcasts.", look: { ...full, size: 7.5 }, keyOnly: false },
            { title: "Key moments", body: "Only the punchlines, big and bold. Best for hooks and fast edits.", look: { ...key, size: 12 }, keyOnly: true },
          ].map((mode) => (
            <article key={mode.title} className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02]">
              <div className="relative aspect-video">
                <img src={mode.keyOnly ? "/media/mic.jpg" : "/media/room.jpg"} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/40" />
                <CaptionOverlay words={words} time={time} look={mode.look} keyOnly={mode.keyOnly} />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold">{mode.title}</h3>
                <p className="mt-1 text-sm text-muted">{mode.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── gallery

function Gallery() {
  const [hover, setHover] = useState<string | null>(null);
  const member = useIsMember();
  const picks = templates.filter((item) => item.featured).slice(0, 12);
  return (
    <section className="mx-auto max-w-7xl px-4 py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHead align="left" kicker="Templates" title={<>Styles that <span className="text-gradient">stop the scroll.</span></>} body={`${templates.length} looks · ${proCount} PRO looks free for launch.`} />
        <Link to="/captions" className={buttonStyles({ tone: "line", size: "md", className: "rounded-full" })}>
          See all templates
        </Link>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {picks.map((template) => (
          <Link
            key={template.id}
            to="/studio"
            search={{ template: template.id }}
            onMouseEnter={() => setHover(template.id)}
            onMouseLeave={() => setHover(null)}
            className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] transition hover:-translate-y-1 hover:border-accent/50"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <img src={["/media/talk.jpg", "/media/mic.jpg", "/media/stage.jpg", "/media/room.jpg", "/media/edit.jpg", "/media/hero.jpg"][templates.indexOf(template) % 6]} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/35" />
              <TemplateThumb look={template} playing={hover === template.id} />
              {template.pro ? (
                <span className="pro-badge absolute top-2 right-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]">
                  {member ? <Crown className="size-3" /> : <Lock className="size-3" />} PRO
                </span>
              ) : (
                <span className="absolute top-2 right-2 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">FREE</span>
              )}
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-medium">{template.name}</span>
              <span className="text-xs text-muted">{template.tag}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── steps

function Steps() {
  const steps = [
    { icon: Upload, title: "Upload", body: "Drop a reel, podcast or long video. It stays on your device." },
    { icon: Wand2, title: "Transcribe", body: "Pick Roman Urdu (or any language). Words arrive with exact timings." },
    { icon: Palette, title: "Style", body: "Choose a template and motion, star key words, fix anything on the timeline." },
    { icon: Zap, title: "Export", body: "MP4 in original quality, 1080p or 720p — plus SRT/VTT for editors." },
  ];
  return (
    <section className="border-y border-white/5 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-24">
        <SectionHead kicker="How it works" title={<>From raw clip to <span className="text-gradient">captioned reel</span> in minutes.</>} />
        <ol className="mt-12 grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="relative rounded-3xl border border-white/8 bg-white/[0.02] p-6">
              <span className="font-display text-5xl font-extrabold text-white/10">0{index + 1}</span>
              <span className="absolute top-6 right-6 grid h-10 w-10 place-items-center rounded-2xl bg-brand">
                <step.icon className="size-5 text-white" />
              </span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── pricing

function Pricing() {
  const member = useIsMember();
  const openLogin = useAccount((state) => state.openLogin);
  const plans = [
    {
      name: "Guest",
      price: "Free",
      sub: "No account needed",
      cta: "Open the studio",
      to: "/studio",
      items: ["AI transcription (Roman Urdu + 35 languages)", `${templates.length - proCount} free caption templates`, "Pro timeline & audio extract", "MP4 export up to original quality", "SRT · VTT · TXT export"],
    },
    {
      name: "Creator",
      price: "Free",
      strike: "PRO",
      sub: `Launch offer until ${LAUNCH_FREE_LABEL}`,
      cta: member ? "You're in — open studio" : "Create free account",
      featured: true,
      items: ["Everything in Guest", `All ${proCount} PRO caption templates`, "All PRO motion presets", "Key-moments caption mode", "Priority on new features"],
    },
    {
      name: "Team",
      price: "Soon",
      sub: "For agencies and brands",
      cta: "Join the waitlist",
      items: ["Everything in Creator", "Shared brand styles", "Multiple editors", "Bulk export", "Dedicated support"],
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24">
      <SectionHead kicker="Pricing" title={<>PRO is <span className="text-gradient-hot">free for two months.</span></>} body="Create a free creator account and every PRO look unlocks. No card. No trial clock until the launch ends." />
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className={`relative flex flex-col rounded-3xl p-7 ${plan.featured ? "gradient-border shadow-[0_30px_80px_-30px_rgba(139,92,246,0.7)]" : "border border-white/8 bg-white/[0.02]"}`}>
            {plan.featured ? <span className="pro-badge absolute -top-3 left-7 rounded-full px-3 py-1 text-[11px]">MOST POPULAR</span> : null}
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              {plan.featured ? <Crown className="size-5 text-pro" /> : null}
              {plan.name}
            </h3>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-extrabold">{plan.price}</span>
              {plan.strike ? <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-muted">all {plan.strike} unlocked</span> : null}
            </p>
            <p className="mt-1 text-sm text-muted">{plan.sub}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {plan.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
            {plan.to ? (
              <Link to={plan.to} className={buttonStyles({ tone: "line", size: "md", className: "mt-7 rounded-full" })}>
                {plan.cta}
              </Link>
            ) : plan.featured ? (
              member ? (
                <Link to="/studio" className={buttonStyles({ tone: "primary", size: "md", className: "mt-7 rounded-full" })}>
                  {plan.cta}
                </Link>
              ) : (
                <button type="button" onClick={() => openLogin()} className={buttonStyles({ tone: "primary", size: "md", className: "shine mt-7 rounded-full" })}>
                  {plan.cta}
                </button>
              )
            ) : (
              <button type="button" onClick={() => openLogin("Join the Cutline Team waitlist")} className={buttonStyles({ tone: "line", size: "md", className: "mt-7 rounded-full" })}>
                {plan.cta}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── FAQ

const FAQS: [string, string][] = [
  ["How is Cutline different from other caption apps?", "Cutline is built around Roman Urdu. Speech is transcribed precisely in Urdu, then written the way Pakistani creators type — so your captions read naturally. You also get a real timeline, After Effects-style motion and true MP4 export in one place."],
  ["Do I need After Effects or Premiere Pro?", "No. Everything runs in your browser. If you do edit in Premiere Pro, DaVinci Resolve or CapCut, export an SRT or word-level SRT and drop it in."],
  ["How accurate is the Roman Urdu transcription?", "Very accurate on clear speech. Word timings come straight from the speech model, and any word can be fixed with a double-click. Adding brand names and people's names in the Transcribe window improves spelling further."],
  ["Which video formats work?", "MP4, MOV, WebM and MKV videos, plus MP3, M4A, WAV and other audio files. Portrait, landscape and square all work — export keeps your original size or 1080p / 720p."],
  ["Can I download just the captions?", "Yes — SRT, word-level SRT, VTT, plain text and JSON are one click away in Export."],
  ["Is my video private?", "Your video never leaves your device. Only a compact audio copy is sent for transcription, and projects are saved in your own browser."],
  ["What is free and what is PRO?", `The studio, transcription and MP4 export are free. PRO templates and motions are marked with a crown — during launch they unlock free with a creator account until ${LAUNCH_FREE_LABEL}.`],
  ["Can my team use Cutline?", "Team workspaces with shared brand styles are on the way. Join the waitlist from the pricing section and we'll let you know first."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-24">
      <SectionHead kicker="FAQ" title={<>Questions, <span className="text-gradient">answered.</span></>} />
      <div className="mt-10 space-y-2">
        {FAQS.map(([question, answer], index) => (
          <div key={question} className={`overflow-hidden rounded-2xl border transition ${open === index ? "border-accent/50 bg-accent/[0.06]" : "border-white/8 bg-white/[0.02]"}`}>
            <button type="button" onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium">
              {question}
              <ChevronDown className={`size-4 shrink-0 transition ${open === index ? "rotate-180 text-accent-2" : "text-muted"}`} />
            </button>
            {open === index ? <p className="px-5 pb-5 text-sm text-muted">{answer}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────── final CTA

function FinalCta() {
  return (
    <section className="px-4 pb-24">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-brand px-6 py-16 text-center sm:px-16">
        <div className="spin-slow pointer-events-none absolute -top-1/2 left-1/2 h-[200%] w-[140%] -translate-x-1/2 bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.18),transparent_30%)]" />
        <h2 className="relative font-display text-4xl leading-tight font-extrabold text-white sm:text-6xl">Your next reel deserves better captions.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-white/80">Upload a video and see your words animate in under a minute.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/studio" search={{ upload: "1" }} className={buttonStyles({ tone: "white", size: "lg", className: "rounded-full px-8" })}>
            <Upload className="size-5" /> Upload a video
          </Link>
          <Link to="/captions" className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 text-white hover:bg-white/10">
            Explore templates
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ kicker, title, body, align = "center" }: { kicker: string; title: React.ReactNode; body?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-semibold tracking-[0.25em] text-accent-2 uppercase">{kicker}</p>
      <h2 className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">{title}</h2>
      {body ? <p className="mt-4 text-lg text-muted">{body}</p> : null}
    </div>
  );
}
