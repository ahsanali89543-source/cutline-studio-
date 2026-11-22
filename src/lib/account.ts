import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { create } from "zustand";

/** PRO looks are unlocked free for signed-in creators until this date. */
export const LAUNCH_FREE_UNTIL = "2027-01-20";
export const LAUNCH_FREE_LABEL = "20 January 2027";

export type Creator = {
  name: string;
  email: string;
  whatsapp?: string;
  joinedAt: number;
};

const KEY = "cutline.creator.v1";

function read(): Creator | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Creator;
    return data && typeof data.email === "string" ? data : null;
  } catch {
    return null;
  }
}

type AccountState = {
  creator: Creator | null;
  ready: boolean;
  loginOpen: boolean;
  loginReason: string | null;
  afterLogin: (() => void) | null;
  hydrate: () => void;
  signIn: (creator: Omit<Creator, "joinedAt">) => Promise<void>;
  signOut: () => void;
  openLogin: (reason?: string, after?: () => void) => void;
  closeLogin: () => void;
};

export const useAccount = create<AccountState>((set, get) => ({
  creator: null,
  ready: false,
  loginOpen: false,
  loginReason: null,
  afterLogin: null,
  hydrate: () => {
    if (get().ready) return;
    set({ creator: read(), ready: true });
  },
  signIn: async (input) => {
    const creator: Creator = {
      name: input.name.trim().slice(0, 80),
      email: input.email.trim().toLowerCase().slice(0, 120),
      whatsapp: input.whatsapp?.trim().slice(0, 30) || undefined,
      joinedAt: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(creator));
    } catch {
      /* private mode — keep it for this session */
    }
    // Record the sign-up; the studio unlocks even if this request fails.
    void fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creator),
    }).catch(() => undefined);
    const after = get().afterLogin;
    set({ creator, loginOpen: false, loginReason: null, afterLogin: null });
    after?.();
  },
  signOut: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ creator: null });
  },
  openLogin: (reason, after) => set({ loginOpen: true, loginReason: reason ?? null, afterLogin: after ?? null }),
  closeLogin: () => set({ loginOpen: false, loginReason: null, afterLogin: null }),
}));

/** True when the visitor may use PRO looks: a creator pass or a real Google/X session. */
export function useIsMember(): boolean {
  const creator = useAccount((state) => state.creator);
  const { user } = useCurrentUserState();
  return Boolean(creator) || Boolean(user && !user.isDevFallback);
}

export function useMemberName(): string | null {
  const creator = useAccount((state) => state.creator);
  const { user } = useCurrentUserState();
  if (creator) return creator.name || creator.email;
  if (user && !user.isDevFallback) return user.displayName ?? user.primaryEmail;
  return null;
}
