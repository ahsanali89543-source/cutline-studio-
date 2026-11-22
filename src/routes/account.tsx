import { PageIntro, SiteFrame } from "@/components/site/Shell";
import { buttonStyles } from "@/components/ui/button";
import { LAUNCH_FREE_LABEL, useAccount, useIsMember, useMemberName } from "@/lib/account";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { luts } from "@/lib/captions/luts";
import { proCount, templates } from "@/lib/captions/templates";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const member = useIsMember();
  const name = useMemberName();
  const creator = useAccount((state) => state.creator);
  const hydrate = useAccount((state) => state.hydrate);
  const signOutCreator = useAccount((state) => state.signOut);
  const openLogin = useAccount((state) => state.openLogin);
  const { user } = useCurrentUserState();
  useEffect(() => hydrate(), [hydrate]);

  const perks = [
    `${templates.length} caption templates (${proCount} PRO)`,
    `${luts.length - 1} colour grades`,
    "AI transcription with Roman Urdu",
    "Pro timeline, split & cut",
    "MP4 export: original, 1080p, 720p",
    "SRT, VTT, TXT, JSON and audio export",
  ];

  return (
    <SiteFrame>
      <PageIntro
        kicker="My account"
        title={member ? `Hello, ${name}.` : "Your Cutline account"}
        body={member ? `Plan: Creator — all PRO unlocked free until ${LAUNCH_FREE_LABEL}.` : "Log in to unlock every PRO template during the launch — no card needed."}
      />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 pb-20 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-white/8 bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold">Included</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {perks.map((perk) => (
              <li key={perk} className="flex gap-2 text-sm text-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                {perk}
              </li>
            ))}
          </ul>
          <Link to="/studio" className={buttonStyles({ tone: "primary", size: "md", className: "mt-6 rounded-full" })}>
            Open the studio
          </Link>
        </section>
        <section className="gradient-border rounded-3xl p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Crown className="size-5 text-pro" /> {member ? "Creator · PRO" : "Guest"}
          </h2>
          <p className="mt-2 text-sm text-muted">{creator?.email ?? user?.primaryEmail ?? "Not signed in"}</p>
          {member ? (
            <button
              type="button"
              className={buttonStyles({ tone: "line", size: "md", className: "mt-6 rounded-full" })}
              onClick={() => {
                if (creator) signOutCreator();
                if (user && !user.isDevFallback && authEnabled) void signOut().catch(() => undefined);
              }}
            >
              Sign out
            </button>
          ) : (
            <button type="button" onClick={() => openLogin()} className={buttonStyles({ tone: "primary", size: "md", className: "mt-6 rounded-full" })}>
              Unlock PRO free
            </button>
          )}
        </section>
      </div>
    </SiteFrame>
  );
}
