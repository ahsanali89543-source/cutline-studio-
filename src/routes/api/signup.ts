import { createFileRoute } from "@tanstack/react-router";

/**
 * Records a free Cutline creator sign-up. If LEADS_WEBHOOK_URL is set (a Google
 * Apps Script, Zapier, Make or n8n webhook), the sign-up is forwarded there so
 * the team gets every new creator in a sheet or CRM.
 */
export const Route = createFileRoute("/api/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "Send JSON." }, { status: 400 });
        }
        const email = String(body.email ?? "").trim().toLowerCase().slice(0, 120);
        const name = String(body.name ?? "").trim().slice(0, 80);
        const whatsapp = String(body.whatsapp ?? "").trim().slice(0, 30);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
        }
        const lead = {
          name,
          email,
          whatsapp,
          source: "cutline-studio",
          at: new Date().toISOString(),
          userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? "",
        };
        console.info("[cutline] creator signup", JSON.stringify({ email, name }));
        const hook = process.env.LEADS_WEBHOOK_URL?.trim();
        if (hook) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            await fetch(hook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(lead),
              signal: controller.signal,
            });
            clearTimeout(timer);
          } catch {
            /* never block the creator on the CRM */
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
