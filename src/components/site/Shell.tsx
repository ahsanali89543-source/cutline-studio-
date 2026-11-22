import { Logo } from "@/components/site/Logo";
import { buttonStyles } from "@/components/ui/button";
import { useAccount, useMemberName } from "@/lib/account";
import { authEnabled, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Link } from "@tanstack/react-router";
import { Crown, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/captions", label: "Templates" },
  { href: "/#languages", label: "Languages" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function SiteFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="min-h-dvh overflow-x-clip bg-bg text-fg">
      <div className="bg-brand-hot py-1.5 text-center text-xs font-medium text-white">
        Launch offer — every PRO template is free for 2 months. <Link to="/studio" className="underline underline-offset-2">Start now →</Link>
      </div>
      <header
        className={`sticky top-0 z-40 transition-all ${scrolled ? "border-b border-white/5 bg-bg/75 backdrop-blur-xl" : "bg-transparent"}`}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />
          <nav className="ml-8 hidden items-center gap-1 lg:flex">
            {links.map((item) => (
              <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-fg">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <AccountSlot />
            </div>
            <Link to="/studio" className={buttonStyles({ tone: "primary", size: "md", className: "hidden rounded-full sm:inline-flex" })}>
              Open Studio
            </Link>
            <button type="button" className="rounded-lg p-2 text-muted hover:bg-white/5 lg:hidden" onClick={() => setOpen((value) => !value)} aria-label="Menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="grid gap-1 border-t border-white/5 bg-bg/95 px-4 py-3 lg:hidden">
            {links.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-fg hover:bg-white/5">
                {item.label}
              </a>
            ))}
            <div className="mt-1 sm:hidden">
              <AccountSlot />
            </div>
            <Link to="/studio" className={buttonStyles({ tone: "primary", size: "md", className: "mt-1 rounded-full" })}>
              Open Studio
            </Link>
          </nav>
        ) : null}
      </header>
      {children}
      <Footer />
    </div>
  );
}

export function AccountSlot({ compact = false }: { compact?: boolean }) {
  const name = useMemberName();
  const creator = useAccount((state) => state.creator);
  const openLogin = useAccount((state) => state.openLogin);
  const signOutCreator = useAccount((state) => state.signOut);
  const hydrate = useAccount((state) => state.hydrate);
  const { user } = useCurrentUserState();
  const [menu, setMenu] = useState(false);
  useEffect(() => hydrate(), [hydrate]);

  if (!name) {
    return (
      <button
        type="button"
        onClick={() => openLogin()}
        className={buttonStyles({ tone: "line", size: compact ? "sm" : "md", className: "rounded-full" })}
      >
        <Crown className="size-4 text-pro" />
        {compact ? "Login" : "Login · PRO free"}
      </button>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenu((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] py-1 pr-3 pl-1 text-sm hover:border-accent/60"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-bold text-white">{name.charAt(0).toUpperCase()}</span>
        <span className="max-w-28 truncate">{name}</span>
        <span className="pro-badge rounded px-1.5 py-0.5 text-[10px]">PRO</span>
      </button>
      {menu ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
          <p className="px-2.5 py-2 text-xs text-muted">{creator?.email ?? user?.primaryEmail ?? "Signed in"}</p>
          <Link to="/account" className="block rounded-lg px-2.5 py-2 text-sm hover:bg-white/5" onClick={() => setMenu(false)}>
            My account
          </Link>
          <Link to="/studio" className="block rounded-lg px-2.5 py-2 text-sm hover:bg-white/5" onClick={() => setMenu(false)}>
            Open Studio
          </Link>
          <button
            type="button"
            className="block w-full rounded-lg px-2.5 py-2 text-left text-sm text-rose-300 hover:bg-white/5"
            onClick={() => {
              setMenu(false);
              if (creator) signOutCreator();
              if (user && !user.isDevFallback && authEnabled) void signOut().catch(() => undefined);
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-white/5">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">
            The AI transcript studio for Roman Urdu creators — word-perfect captions, animated templates and MP4 export in one browser tab.
          </p>
        </div>
        <FooterCol title="Product" items={[["Studio", "/studio"], ["Templates", "/captions"], ["Colour grades", "/luts"], ["How it works", "/how"]]} />
        <FooterCol title="Resources" items={[["Languages", "/#languages"], ["Pricing", "/#pricing"], ["FAQ", "/#faq"], ["Support", "/support"]]} />
        <FooterCol title="Account" items={[["Login", "/login"], ["My account", "/account"]]} />
      </div>
      <div className="border-t border-white/5">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted">© {new Date().getFullYear()} Cutline Studio. All rights reserved.</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-widest text-fg/70 uppercase">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">
        {items.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="hover:text-fg">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PageIntro({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="relative overflow-hidden">
      <div className="aurora opacity-40">
        <span />
        <span />
        <span />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-10">
        <p className="text-xs font-semibold tracking-[0.25em] text-accent-2 uppercase">{kicker}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{body}</p>
      </div>
    </div>
  );
}
