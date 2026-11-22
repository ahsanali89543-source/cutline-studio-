import { SiteFrame } from "@/components/site/Shell";
import { buttonStyles } from "@/components/ui/button";
import { LAUNCH_FREE_LABEL, useAccount, useIsMember } from "@/lib/account";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const member = useIsMember();
  const openLogin = useAccount((state) => state.openLogin);
  const hydrate = useAccount((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (!member) openLogin();
  }, [member, openLogin]);
  return (
    <SiteFrame>
      <main className="relative mx-auto max-w-lg px-4 py-24 text-center">
        <div className="aurora opacity-50">
          <span />
          <span />
          <span />
        </div>
        <span className="pro-badge relative inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs">
          <Crown className="size-3.5" /> PRO FREE UNTIL {LAUNCH_FREE_LABEL.toUpperCase()}
        </span>
        <h1 className="relative mt-4 font-display text-5xl leading-tight font-extrabold">{member ? "You're signed in." : "Log in to unlock PRO"}</h1>
        <p className="relative mt-3 text-muted">
          {member ? "Every PRO template and motion is unlocked on this browser." : "One free creator account unlocks every PRO caption style and motion preset."}
        </p>
        <div className="relative mt-8 flex justify-center gap-3">
          {member ? (
            <Link to="/studio" className={buttonStyles({ tone: "primary", size: "lg", className: "rounded-full" })}>
              Open the studio
            </Link>
          ) : (
            <button type="button" onClick={() => openLogin()} className={buttonStyles({ tone: "primary", size: "lg", className: "rounded-full" })}>
              Create free account
            </button>
          )}
        </div>
      </main>
    </SiteFrame>
  );
}
