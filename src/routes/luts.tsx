import { PageIntro, SiteFrame } from "@/components/site/Shell";
import { lutTones, luts } from "@/lib/captions/luts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/luts")({ component: LutsPage });

const stills = ["/media/room.jpg", "/media/stage.jpg", "/media/talk.jpg", "/media/mic.jpg"];

function LutsPage() {
  const [tone, setTone] = useState<(typeof lutTones)[number]>("All");
  const grades = luts.filter((item) => item.id !== "neutral" && (tone === "All" || item.tone === tone));
  return (
    <SiteFrame>
      <PageIntro
        kicker="Color"
        title="Trending grades, included."
        body="Teal and orange, Portra warmth, drama lamps, night city. Preview them live and burn them into your MP4 export."
      />
      <div className="mx-auto max-w-6xl px-4 pb-14">
        <div className="flex gap-2 overflow-x-auto">
          {lutTones.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTone(item)}
              className={`h-9 shrink-0 rounded-full border px-3 text-sm ${tone === item ? "border-transparent bg-brand text-white" : "border-line text-muted"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {grades.map((grade, index) => (
            <Link key={grade.id} to="/studio" search={{ grade: grade.id }} className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] transition hover:-translate-y-1 hover:border-accent/50">
              <div className="relative">
                <img src={stills[index % stills.length]} alt="" className="aspect-video w-full object-cover" style={{ filter: grade.filter }} />
                {grade.wash ? (
                  <span className="absolute inset-0" style={{ background: grade.wash, opacity: grade.washOpacity, mixBlendMode: "soft-light" }} />
                ) : null}
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <div>
                  <h2 className="text-base">{grade.name}</h2>
                  <p className="text-sm text-muted">{grade.blurb}</p>
                </div>
                <span className="rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">FREE</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SiteFrame>
  );
}
