import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { LoginDialog } from "@/components/site/LoginDialog";
import appCss from "../styles.css?url";

const APP_NAME = "Cutline Studio — AI Roman Urdu captions";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bangers&family=Barlow+Condensed:wght@600;700&family=Bebas+Neue&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Bungee&family=Caveat:wght@700&family=Cinzel:wght@600;700&family=Dancing+Script:wght@700&family=Dela+Gothic+One&family=Fraunces:ital,opsz,wght@0,9..144,560;0,9..144,700;1,9..144,620;1,9..144,700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500&family=Kalam:wght@700&family=Kaushan+Script&family=Kanit:ital,wght@0,700;0,800;1,700;1,800&family=Lilita+One&family=Luckiest+Guy&family=Montserrat:wght@600;700;800;900&family=Noto+Nastaliq+Urdu:wght@600&family=Noto+Sans+Devanagari:wght@600;800&family=Oswald:wght@600&family=Outfit:wght@400;500;560;600;700&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,700;1,700&family=Poppins:wght@600;700;800;900&family=Righteous&family=Russo+One&family=Sora:wght@600;700;800&family=Space+Grotesk:wght@500;700&family=Syne:wght@700;800&family=Titan+One&display=swap";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Cutline Studio turns your videos into animated, word-timed captions. AI transcription built for Roman Urdu, 45+ creative templates, a pro timeline and MP4 export.",
      },
      { name: "theme-color", content: "#06060c" },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: "AI captions for Roman Urdu creators. Transcribe, style, export MP4." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <LoginDialog />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
