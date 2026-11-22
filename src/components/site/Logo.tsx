import { Link } from "@tanstack/react-router";

/**
 * Brand mark. Replace /public/logo.svg with the Cutline logo file and it shows
 * up here, in the studio header and as the favicon.
 */
export function Logo({ compact = false, to = "/" }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="Cutline Studio home">
      <img src="/logo.svg" alt="" className="h-9 w-9 rounded-xl shadow-[0_6px_24px_-6px_rgba(139,92,246,0.8)] transition-transform group-hover:rotate-[-6deg]" />
      {compact ? null : (
        <span className="font-display text-lg leading-none font-extrabold tracking-tight whitespace-nowrap">
          Cutline<span className="text-gradient"> Studio</span>
        </span>
      )}
    </Link>
  );
}
