import { Button } from "@/components/ui/button";
import { LAUNCH_FREE_LABEL, useAccount } from "@/lib/account";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Crown, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const perks = ["All PRO caption templates", "PRO motion presets", "Roman Urdu AI transcription", "MP4 export in original quality"];

export function LoginDialog() {
  const open = useAccount((state) => state.loginOpen);
  const reason = useAccount((state) => state.loginReason);
  const close = useAccount((state) => state.closeLogin);
  const hydrate = useAccount((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="gradient-border fade-up relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-2xl">
        <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        <button type="button" onClick={close} className="absolute top-3 right-3 rounded-full p-2 text-muted hover:bg-white/5 hover:text-fg" aria-label="Close">
          <X className="size-4" />
        </button>
        <span className="pro-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]">
          <Crown className="size-3" /> PRO · FREE FOR LAUNCH
        </span>
        <h2 className="mt-3 font-display text-3xl leading-tight font-extrabold">
          {reason ?? "Create your free creator account"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          Sign in once and every PRO look unlocks — no card, no payment. Free until {LAUNCH_FREE_LABEL}.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-fg/90">
          {perks.map((perk) => (
            <li key={perk} className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5">
              <Sparkles className="size-3 shrink-0 text-accent-2" />
              {perk}
            </li>
          ))}
        </ul>
        {authEnabled ? (
          <div className="mt-5 grid gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <Button
                key={provider.providerId}
                tone={provider.providerId === "grok-google" ? "white" : "line"}
                size="md"
                onClick={() => void signIn(provider.providerId, { callbackURL: window.location.pathname }).catch(() => undefined)}
              >
                Continue with {provider.label}
              </Button>
            ))}
            <p className="text-center text-xs text-muted">or use your email</p>
          </div>
        ) : null}
        <EmailForm />
      </div>
    </div>
  );
}

function EmailForm() {
  const signInCreator = useAccount((state) => state.signIn);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field =
    "h-11 w-full rounded-lg border border-line bg-black/30 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";
  return (
    <form
      className="mt-4 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          setError("Enter a valid email address.");
          return;
        }
        setBusy(true);
        void signInCreator({ name: name || email.split("@")[0], email, whatsapp }).finally(() => setBusy(false));
      }}
    >
      <input className={field} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
      <input
        className={field}
        placeholder="Email address"
        type="email"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setError(null);
        }}
        autoComplete="email"
      />
      <input className={field} placeholder="WhatsApp (optional)" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} autoComplete="tel" />
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      <Button type="submit" tone="primary" size="lg" className="mt-1 w-full shine" disabled={busy}>
        {busy ? "Unlocking…" : "Unlock PRO free"}
      </Button>
      <p className="text-center text-[11px] text-muted">We'll only use this to send product updates. Unsubscribe anytime.</p>
    </form>
  );
}
