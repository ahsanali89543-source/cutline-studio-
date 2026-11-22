import { PageIntro, SiteFrame } from "@/components/site/Shell";
import { buttonStyles } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/how")({ component: How });

const steps: [string, string][] = [
  ["Upload", "Drop a portrait, landscape or square video — or a podcast audio file. It stays on your device."],
  ["Transcribe", "Roman Urdu is selected by default. Pick another language if you need it, add brand names, press Transcribe now."],
  ["Fix & time", "Double-click any word to edit. Drag words on the Captions track; drag edges to trim; Alt-drag to shift everything after."],
  ["Style", "Pick a template (PRO looks unlock free with a login), choose a motion, star key words, set the colour grade."],
  ["Cut", "Split at the playhead, select a piece on the Video track and delete it. Removed pieces are skipped in the export."],
  ["Export", "MP4 in original quality, 1080p or 720p. SRT/VTT for Premiere, DaVinci or CapCut. Audio as M4A or WAV."],
];

function How() {
  return (
    <SiteFrame>
      <PageIntro kicker="How it works" title="From a raw clip to a captioned reel." body="One studio: upload, transcribe, style, cut and export." />
      <ol className="mx-auto grid max-w-5xl gap-3 px-4 sm:grid-cols-2">
        {steps.map(([title, body], index) => (
          <li key={title} className="rounded-3xl border border-white/8 bg-white/[0.02] p-6">
            <span className="font-display text-4xl font-extrabold text-gradient">{String(index + 1).padStart(2, "0")}</span>
            <h2 className="mt-2 text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </li>
        ))}
      </ol>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Link to="/studio" className={buttonStyles({ tone: "primary", size: "lg", className: "rounded-full" })}>
          Open the studio
        </Link>
      </div>
    </SiteFrame>
  );
}
