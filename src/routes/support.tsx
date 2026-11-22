import { PageIntro, SiteFrame } from "@/components/site/Shell";
import { LAUNCH_FREE_LABEL } from "@/lib/account";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/support")({ component: Support });

const faqs: [string, string][] = [
  ["Transcribe says it failed — what now?", "Check your connection and try again. Very long videos are split into parts automatically. If it still fails, the site owner needs a transcription key on the server (XAI_API_KEY, GROQ_API_KEY or OPENAI_API_KEY)."],
  ["The Roman Urdu spelling of a word is off", "Double-click the word in the transcript or on the timeline and type the spelling you want. Add brand names and people's names in the Transcribe window before you start for better results."],
  ["How do I move a caption earlier or later?", "Drag the word on the Captions track. Drag its edges to make it longer or shorter. Hold Alt while dragging to move every word after it too. Shift-click selects several words."],
  ["How do I cut part of the video?", "Move the playhead, press Split (or S), click the piece you don't want on the Video track and press Delete. Click a removed piece to bring it back."],
  ["My MP4 export is slow or failed", "Use Chrome or Edge on a laptop for the fastest export. Try 1080p or 720p for very large 4K files. Export runs on your computer, so keep the tab open until it finishes."],
  ["What's PRO?", `PRO templates and motions are marked with a crown. During launch they unlock free with a creator account until ${LAUNCH_FREE_LABEL}.`],
  ["Where are my projects saved?", "In this browser. Re-attach the same video when you reopen a project to see the picture again."],
];

function Support() {
  return (
    <SiteFrame>
      <PageIntro kicker="Support" title="Quick answers." body="If a word is wrong, double-click it. If a line is late, drag it. Everything else is below." />
      <div className="mx-auto max-w-3xl space-y-2 px-4 pb-10">
        {faqs.map(([q, a]) => (
          <article key={q} className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <h2 className="font-semibold">{q}</h2>
            <p className="mt-2 text-sm text-muted">{a}</p>
          </article>
        ))}
      </div>
      <p className="mx-auto max-w-3xl px-4 pb-20 text-sm text-muted">
        Ready to try a file?{" "}
        <Link to="/studio" className="text-accent-2">
          Open the studio
        </Link>
        .
      </p>
    </SiteFrame>
  );
}
