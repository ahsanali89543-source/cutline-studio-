import { TemplateThumb } from "@/components/captions/CaptionOverlay";
import { PageIntro, SiteFrame } from "@/components/site/Shell";
import { useIsMember } from "@/lib/account";
import { matchesTag, proCount, templateTags, templates } from "@/lib/captions/templates";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Lock, Search } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/captions")({ component: CaptionsPage });

const STILLS = ["/media/talk.jpg", "/media/mic.jpg", "/media/stage.jpg", "/media/room.jpg", "/media/edit.jpg", "/media/hero.jpg"];

function CaptionsPage() {
  const [tag, setTag] = useState("All");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const member = useIsMember();
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((item) => {
      if (!matchesTag(item, tag)) return false;
      if (!needle) return true;
      return `${item.name} ${item.blurb} ${item.tag} ${item.sample}`.toLowerCase().includes(needle);
    });
  }, [query, tag]);

  return (
    <SiteFrame>
      <PageIntro
        kicker="Caption templates"
        title={`${templates.length} styles. ${proCount} PRO — free for launch.`}
        body="Hover any card to see it move. Click to open it in the studio with your own video."
      />
      <div className="mx-auto max-w-7xl px-4 pb-20">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 min-w-56 flex-1 items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3">
            <Search className="size-4 text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" aria-label="Find a template" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          {templateTags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag(item)}
              className={`h-9 rounded-full border px-3.5 text-sm transition ${tag === item ? "border-transparent bg-brand text-white" : "border-line text-muted hover:text-fg"}`}
            >
              {item === "PRO" ? "★ PRO" : item}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">{visible.length} templates</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((template, index) => (
            <Link
              key={template.id}
              to="/studio"
              search={{ template: template.id }}
              onMouseEnter={() => setHover(template.id)}
              onMouseLeave={() => setHover(null)}
              className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] transition hover:-translate-y-1 hover:border-accent/50"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img src={STILLS[index % STILLS.length]} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-black/40" />
                <TemplateThumb look={template} playing={hover === template.id} />
                {template.pro ? (
                  <span className="pro-badge absolute top-2 right-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]">
                    {member ? <Crown className="size-3" /> : <Lock className="size-3" />} PRO
                  </span>
                ) : (
                  <span className="absolute top-2 right-2 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">FREE</span>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="flex items-center justify-between gap-2 text-sm font-medium">
                  <span className="truncate">{template.name}</span>
                  <span className="shrink-0 text-xs text-muted">{template.tag}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">{template.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SiteFrame>
  );
}
