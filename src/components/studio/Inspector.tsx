import { TemplateThumb } from "@/components/captions/CaptionOverlay";
import { Button } from "@/components/ui/button";
import { useAccount, useIsMember } from "@/lib/account";
import { downloadBlob, safeName } from "@/lib/captions/io";
import { lutTones, luts } from "@/lib/captions/luts";
import { mediaBridge } from "@/lib/captions/media";
import { extractAudio } from "@/lib/captions/media-engine";
import { ANIMATIONS } from "@/lib/captions/render";
import { useStudio } from "@/lib/captions/store";
import { matchesTag, proCount, templateTags, templates } from "@/lib/captions/templates";
import { FONTS, type CaptionAnimation, type CaptionLook } from "@/lib/captions/types";
import { Crown, Lock, Search, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

const field = "h-9 w-full rounded-lg border border-line bg-black/20 px-2 text-sm text-fg outline-none focus:border-accent";

type Tab = "templates" | "style" | "motion" | "grade" | "audio";

export function Inspector() {
  const look = useStudio((state) => state.project.look);
  const [tab, setTab] = useState<Tab>("templates");
  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface/60 lg:border-l lg:border-white/5">
      <header className="border-b border-white/5 px-2 pt-2">
        <div className="flex gap-0.5 overflow-x-auto">
          {(
            [
              ["templates", "Templates"],
              ["style", "Style"],
              ["motion", "Motion"],
              ["grade", "Colour"],
              ["audio", "Audio"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative h-9 shrink-0 rounded-t-lg px-3 text-sm transition ${tab === id ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
              {tab === id ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" /> : null}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "templates" ? <TemplatesTab current={look} /> : null}
        {tab === "style" ? <StyleTab look={look} /> : null}
        {tab === "motion" ? <MotionTab look={look} /> : null}
        {tab === "grade" ? <GradeTab /> : null}
        {tab === "audio" ? <AudioTab /> : null}
        <SelectionEditor />
      </div>
    </aside>
  );
}

export function useProGate() {
  const member = useIsMember();
  const openLogin = useAccount((state) => state.openLogin);
  return (pro: boolean | undefined, run: () => void, label = "This PRO look") => {
    if (!pro || member) {
      run();
      return;
    }
    openLogin(`${label} is PRO — unlock it free`, run);
  };
}

function TemplatesTab({ current }: { current: CaptionLook }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("All");
  const [hover, setHover] = useState<string | null>(null);
  const member = useIsMember();
  const gate = useProGate();
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((item) => {
      if (!matchesTag(item, tag)) return false;
      if (!needle) return true;
      return `${item.name} ${item.blurb} ${item.tag} ${item.sample}`.toLowerCase().includes(needle);
    });
  }, [query, tag]);
  const baseId = current.id.replace(/^custom-/, "");
  return (
    <div className="space-y-3">
      {!member ? (
        <button
          type="button"
          onClick={() => useAccount.getState().openLogin()}
          className="shine flex w-full items-center gap-3 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-fuchsia-500/10 p-3 text-left"
        >
          <Crown className="size-5 shrink-0 text-pro" />
          <span className="text-xs">
            <b className="block text-sm text-fg">{proCount} PRO looks — free for launch</b>
            <span className="text-muted">Log in once to unlock every PRO template and motion.</span>
          </span>
        </button>
      ) : null}
      <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-black/20 px-2 text-sm">
        <Search className="size-3.5 text-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Find a template" />
      </label>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {templateTags.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTag(item)}
            className={`h-7 shrink-0 rounded-full border px-2.5 text-xs transition ${tag === item ? "border-transparent bg-brand text-white" : "border-line text-muted hover:text-fg"}`}
          >
            {item === "PRO" ? "★ PRO" : item}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {visible.map((template) => {
          const on = baseId === template.id;
          const locked = template.pro && !member;
          return (
            <button
              key={template.id}
              type="button"
              data-testid={`template-${template.id}`}
              onMouseEnter={() => setHover(template.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => gate(template.pro, () => useStudio.getState().applyLook(template), template.name)}
              className={`group relative rounded-xl border p-1.5 text-left transition ${on ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(139,92,246,0.6)]" : "border-line hover:border-white/25"}`}
            >
              <div className="relative h-20 overflow-hidden rounded-lg bg-[linear-gradient(160deg,#27272a,#0b0b12)]">
                <TemplateThumb look={template} playing={hover === template.id} />
                {template.pro ? (
                  <span className="pro-badge absolute top-1 right-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px]">
                    {locked ? <Lock className="size-2.5" /> : <Crown className="size-2.5" />} PRO
                  </span>
                ) : null}
              </div>
              <span className="mt-1 flex items-center justify-between gap-1 px-0.5 text-xs">
                <span className="truncate font-medium">{template.name}</span>
                {!template.pro ? <span className="shrink-0 text-[10px] text-emerald-300">FREE</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StyleTab({ look }: { look: CaptionLook }) {
  const captionMode = useStudio((state) => state.project.captionMode ?? "full");
  const checkpoint = () => useStudio.getState().beginGesture();
  const revise = (patch: Partial<CaptionLook>) => useStudio.getState().reviseLook(patch);
  const commit = (patch: Partial<CaptionLook>) => {
    checkpoint();
    revise(patch);
  };
  return (
    <div className="space-y-4">
      <Section title="Caption mode">
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["full", "Full captions", "Every word, timed to speech"],
              ["key", "Key moments", "Only ★ hooks and punchlines"],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              onClick={() => useStudio.getState().setCaptionMode(id)}
              className={`rounded-lg border p-2 text-left ${captionMode === id ? "border-accent bg-accent/10" : "border-line"}`}
            >
              <span className="block text-xs font-semibold">{label}</span>
              <span className="block text-[10px] text-muted">{hint}</span>
            </button>
          ))}
        </div>
        <Button tone="line" size="xs" className="mt-2 w-full" onClick={() => useStudio.getState().autoKeyWords()}>
          <Wand2 className="size-3.5" /> Auto-pick key words
        </Button>
      </Section>
      <Section title="Font">
        <select className={field} value={look.fontFamily} onChange={(event) => commit({ fontFamily: event.target.value })} style={{ fontFamily: look.fontFamily }}>
          {FONTS.map((font) => (
            <option key={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
        {look.mode === "headline" || look.accentFont ? (
          <label className="mt-2 block text-[11px] text-muted">
            Hero / accent font
            <select
              className={`${field} mt-1`}
              value={look.accentFont?.family ?? ""}
              style={{ fontFamily: look.accentFont?.family ?? look.fontFamily }}
              onChange={(event) => {
                const family = event.target.value;
                commit({ accentFont: family ? { ...(look.accentFont ?? { weight: look.fontWeight, italic: look.italic }), family } : null });
              }}
            >
              <option value="">Same as main font</option>
              {FONTS.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {look.mode === "headline" ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Slider label="Hero size" value={look.emphasisScale ?? 1.7} min={1} max={2.6} step={0.05} onStart={checkpoint} onChange={(emphasisScale) => revise({ emphasisScale })} />
            <Slider label="Small words" value={look.leadScale ?? 0.58} min={0.35} max={1.1} step={0.01} onStart={checkpoint} onChange={(leadScale) => revise({ leadScale })} />
          </div>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Slider label="Size" value={look.size} min={2} max={16} step={0.1} onStart={checkpoint} onChange={(size) => revise({ size })} />
          <Slider label="Weight" value={look.fontWeight} min={400} max={900} step={100} onStart={checkpoint} onChange={(fontWeight) => revise({ fontWeight })} />
          <Slider label="Letter spacing" value={look.tracking} min={-0.04} max={0.3} step={0.01} onStart={checkpoint} onChange={(tracking) => revise({ tracking })} />
          <Slider label="Words per line" value={look.wordsPerCue} min={1} max={10} step={1} onStart={checkpoint} onChange={(wordsPerCue) => revise({ wordsPerCue })} />
          <Slider label="Position" value={look.y} min={8} max={92} step={1} onStart={checkpoint} onChange={(y) => revise({ y })} />
          <Slider label="Active word zoom" value={look.activeScale ?? 1} min={1} max={1.4} step={0.01} onStart={checkpoint} onChange={(activeScale) => revise({ activeScale })} />
        </div>
      </Section>
      <Section title="Colour">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <ColorField label="Text" value={look.color} onStart={checkpoint} onChange={(color) => revise({ color, gradient: null })} />
          <ColorField label="Active word" value={look.highlight} onStart={checkpoint} onChange={(highlight) => revise({ highlight, palette: undefined })} />
          <ColorField label="Outline" value={look.stroke} onStart={checkpoint} onChange={(stroke) => revise({ stroke })} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Slider label="Outline" value={look.strokeWidth} min={0} max={14} step={0.5} onStart={checkpoint} onChange={(strokeWidth) => revise({ strokeWidth })} />
          <Slider label="Upcoming words" value={look.upcomingAlpha ?? 1} min={0.1} max={1} step={0.05} onStart={checkpoint} onChange={(upcomingAlpha) => revise({ upcomingAlpha })} />
        </div>
      </Section>
      <Section title="Effects">
        <div className="flex flex-wrap gap-1.5">
          <Toggle on={look.uppercase} label="CAPS" onClick={() => commit({ uppercase: !look.uppercase })} />
          <Toggle on={look.italic} label="Italic" onClick={() => commit({ italic: !look.italic })} />
          <Toggle on={look.shadow} label="Glow" onClick={() => commit({ shadow: !look.shadow })} />
          <Toggle on={Boolean(look.dropShadow)} label="Shadow" onClick={() => commit({ dropShadow: look.dropShadow ? null : { x: 0.04, y: 0.06, blur: 0.08, color: "rgba(0,0,0,0.75)" } })} />
          <Toggle on={look.activeFill} label="Word box" onClick={() => commit({ activeFill: !look.activeFill })} />
          <Toggle on={Boolean(look.background)} label="Plate" onClick={() => commit({ background: look.background ? null : "#000000", backgroundOpacity: 0.6 })} />
          <Toggle on={Boolean(look.extrude)} label="3D" onClick={() => commit({ extrude: look.extrude ? null : { depth: 6, color: "#3b0764" } })} />
        </div>
        <div className="mt-2 flex gap-1">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => commit({ align })}
              className={`h-8 flex-1 rounded-lg border text-xs capitalize ${look.align === align ? "border-accent text-fg" : "border-line text-muted"}`}
            >
              {align}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Grouping">
        <select className={field} value={look.mode} onChange={(event) => commit({ mode: event.target.value as CaptionLook["mode"] })}>
          <option value="phrase">Phrase — whole line at once</option>
          <option value="reveal">Word by word — appear as spoken</option>
          <option value="single">One word at a time</option>
          <option value="karaoke">Karaoke — colour sweep</option>
          <option value="stack">Stack — one word per line</option>
          <option value="headline">Headline — small words + one big hero word</option>
        </select>
        {look.mode === "headline" ? (
          <p className="mt-2 text-[11px] text-muted">The hero is the word you mark as ★ Key word in the transcript; otherwise the look picks one per line.</p>
        ) : null}
      </Section>
    </div>
  );
}

function MotionTab({ look }: { look: CaptionLook }) {
  const [hover, setHover] = useState<string | null>(null);
  const member = useIsMember();
  const gate = useProGate();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">How each line (or word) enters. Hover to preview.</p>
      <Toggle
        on={Boolean(look.perWord) || (look.mode !== "phrase" && look.mode !== "headline")}
        label={look.mode === "phrase" || look.mode === "headline" ? (look.perWord ? "Animating each word" : "Animating the whole line") : "Animating each word"}
        onClick={() => {
          if (look.mode !== "phrase" && look.mode !== "headline") return;
          useStudio.getState().beginGesture();
          useStudio.getState().reviseLook({ perWord: !look.perWord });
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        {ANIMATIONS.map((animation) => {
          const preview = { ...look, animation: animation.id as CaptionAnimation, mode: (look.mode === "phrase" || look.mode === "headline") && !look.perWord ? (look.mode === "headline" ? "headline" : "reveal") : look.mode, perWord: look.mode === "headline" ? true : look.perWord } as CaptionLook;
          const on = look.animation === animation.id;
          return (
            <button
              key={animation.id}
              type="button"
              onMouseEnter={() => setHover(animation.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() =>
                gate(animation.pro, () => {
                  useStudio.getState().beginGesture();
                  useStudio.getState().reviseLook({ animation: animation.id });
                }, animation.name)
              }
              className={`rounded-xl border p-1.5 text-left ${on ? "border-accent bg-accent/10" : "border-line hover:border-white/25"}`}
            >
              <div className="relative h-14 overflow-hidden rounded-lg bg-[linear-gradient(160deg,#27272a,#0b0b12)]">
                <TemplateThumb look={{ ...preview, y: 50, size: Math.min(preview.size, 9) }} sample="dekho yeh motion" playing={hover === animation.id} />
                {animation.pro ? (
                  <span className="pro-badge absolute top-1 right-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px]">
                    {member ? <Crown className="size-2.5" /> : <Lock className="size-2.5" />} PRO
                  </span>
                ) : null}
              </div>
              <span className="mt-1 block px-0.5 text-xs font-medium">{animation.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GradeTab() {
  const gradeId = useStudio((state) => state.project.gradeId);
  const [tone, setTone] = useState<(typeof lutTones)[number]>("All");
  const grades = luts.filter((item) => tone === "All" || item.tone === tone);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Film looks for the picture. They are burned into the MP4 export.</p>
      <div className="flex gap-1 overflow-x-auto">
        {lutTones.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTone(item)}
            className={`h-7 shrink-0 rounded-full border px-2.5 text-xs ${tone === item ? "border-transparent bg-brand text-white" : "border-line text-muted"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {grades.map((grade) => (
          <button
            key={grade.id}
            type="button"
            onClick={() => useStudio.getState().applyGrade(grade.id)}
            className={`overflow-hidden rounded-xl border text-left ${gradeId === grade.id ? "border-accent" : "border-line"}`}
          >
            <span className="relative block h-12">
              <img src="/media/talk.jpg" alt="" className="h-full w-full object-cover" style={{ filter: grade.filter === "none" ? undefined : grade.filter }} />
              {grade.wash ? <span className="absolute inset-0" style={{ background: grade.wash, opacity: grade.washOpacity, mixBlendMode: "soft-light" }} /> : null}
            </span>
            <span className="block px-2 pt-1 text-xs font-medium">{grade.name}</span>
            <span className="block truncate px-2 pb-1.5 text-[10px] text-muted">{grade.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AudioTab() {
  const voice = useStudio((state) => state.project.voice);
  const speakers = useStudio((state) => state.project.speakers);
  const [busy, setBusy] = useState<string | null>(null);
  async function extract(format: "m4a" | "wav") {
    if (!mediaBridge.file) {
      useStudio.getState().setNote("Upload a video first, then extract its audio.");
      return;
    }
    setBusy(`${format.toUpperCase()} 0%`);
    try {
      const blob = await extractAudio(mediaBridge.file, format, (value) => setBusy(`${format.toUpperCase()} ${Math.round(value * 100)}%`));
      downloadBlob(`${safeName(useStudio.getState().project.name)}-audio.${format}`, blob);
    } catch (error) {
      useStudio.getState().setNote(error instanceof Error ? error.message : "Could not extract audio.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-4">
      <Section title="Extract audio">
        <p className="text-xs text-muted">Pull the soundtrack out of your video — the M4A keeps the original quality.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button tone="line" size="sm" disabled={Boolean(busy)} onClick={() => void extract("m4a")}>
            {busy?.startsWith("M4A") ? busy : "M4A (AAC)"}
          </Button>
          <Button tone="line" size="sm" disabled={Boolean(busy)} onClick={() => void extract("wav")}>
            {busy?.startsWith("WAV") ? busy : "WAV"}
          </Button>
        </div>
      </Section>
      <Section title="Voice clean (preview)">
        <p className="text-xs text-muted">Rumble cut, presence and a gentle compressor while you edit.</p>
        <div className="mt-2">
          <Toggle on={voice.clean} label={voice.clean ? "Voice clean on" : "Voice clean off"} onClick={() => useStudio.getState().patchVoice({ clean: !voice.clean })} />
        </div>
        <div className="mt-2 grid gap-2">
          <Slider label="Rumble cut (Hz)" value={voice.rumble} min={60} max={240} step={5} onStart={() => undefined} onChange={(rumble) => useStudio.getState().patchVoice({ rumble })} />
          <Slider label="Presence" value={voice.presence} min={0} max={8} step={0.1} onStart={() => undefined} onChange={(presence) => useStudio.getState().patchVoice({ presence })} />
          <Slider label="Compress" value={voice.compress} min={0} max={1} step={0.05} onStart={() => undefined} onChange={(compress) => useStudio.getState().patchVoice({ compress })} />
        </div>
      </Section>
      {Object.keys(speakers).length ? (
        <Section title="Speakers">
          <div className="space-y-2">
            {Object.entries(speakers).map(([id, name]) => (
              <input key={id} className={field} value={name} onChange={(event) => useStudio.getState().setSpeakerName(id, event.target.value)} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function SelectionEditor() {
  const selected = useStudio((state) => state.project.words.find((word) => word.id === state.selectedId) ?? null);
  if (!selected) return null;
  return (
    <div className="mt-4 rounded-xl border border-line bg-black/20 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <Sparkles className="size-3.5 text-accent-2" /> Selected word
      </p>
      <input
        className={`${field} mt-2`}
        value={selected.text}
        onChange={(event) => useStudio.getState().placeWord(selected.id, { text: event.target.value })}
        onBlur={(event) => useStudio.getState().editText(selected.id, event.target.value)}
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted">
          In (s)
          <input className={`${field} mt-1 font-mono`} type="number" step="0.01" value={selected.start} onChange={(event) => useStudio.getState().updateWord(selected.id, { start: Number(event.target.value) })} />
        </label>
        <label className="text-[11px] text-muted">
          Out (s)
          <input className={`${field} mt-1 font-mono`} type="number" step="0.01" value={selected.end} onChange={(event) => useStudio.getState().updateWord(selected.id, { end: Number(event.target.value) })} />
        </label>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold tracking-widest text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onStart,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onStart: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[11px] text-muted">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-fg/80">{Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}</span>
      </span>
      <input className="mt-1 w-full" type="range" min={min} max={max} step={step} value={value} onPointerDown={onStart} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ColorField({ label, value, onStart, onChange }: { label: string; value: string; onStart: () => void; onChange: (value: string) => void }) {
  return (
    <label className="text-[11px] text-muted">
      {label}
      <input className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-line bg-transparent" type="color" value={toHex(value)} onPointerDown={onStart} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-lg border px-2.5 text-xs transition ${on ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );
}

function toHex(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return "#ffffff";
}
