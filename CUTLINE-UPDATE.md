# Cutline Studio — update notes

## Update 21 Nov 2026 (b) — 11 new "Headline" caption templates

New **Headline** caption mode (`render.ts`): small "lead" words around one big "hero" word,
the way intro titles look ("hello and / WELCOME / to the show"). The hero is any word
marked ★ Key word in the transcript; otherwise the look picks one per caption
(`heroPick`: longest word, shortest joining word, or the second half of the line).
New look options: `accentFont` (second typeface for the hero), `accentColor`,
`accentGradient`, `accentGlow`, `accentBox`, `leadScale`, `leadColor`, `edgeAlign`
(lead lines hug the hero's left/right edges), `heroInline` (accent word stays in the line).
Also: a single word wider than the frame now shrinks to fit instead of running off.

Templates (new **Headline** chip in the gallery): Red Headline, Lime Glow, Kathmandu,
Karachi, Mumbai, Saffron Brush (PRO) · Clean Condensed, Bubbles, Delhi, Goa, Marker Note
(free). New fonts: Kaushan Script, Dancing Script, Kalam. Style tab: Headline grouping,
hero/accent font picker, Hero size and Small words sliders.

## Update 21 Nov 2026 — timeline fix + My Recent Projects

**Timeline / caption bug fixed.** Captions were grouped only by "words per line", so one
caption could hold the last words before a silence *and* the first words after it. That
caption stayed on screen for the whole silence and showed the upcoming words early, while
the timeline showed nothing there. Now (`src/lib/captions/timing.ts → buildCues`):

- a caption always ends at a silence longer than 0.6 s (`CUE_GAP`) and never stays up
  longer than 4.5 s (`CUE_MAX_SPAN`);
- words are always kept in playback order (a trim-drag could leave them unsorted, which
  broke caption lookup and lane stacking);
- words inside a removed (cut) section are never drawn, in the preview or the MP4;
- preview, MP4 export, SRT/VTT and the timeline all read one plan (`captionPlan` in
  `render.ts`), so they can no longer disagree.

**Timeline now shows what is on screen.** A thin "on screen" strip above the words shows
one bar per caption for exactly the time it is visible (the live one turns yellow; click
a bar to select its words). Word colours follow the real caption groups; hidden words
(key-moments mode, cut sections) are grey. Lanes are packed in time order. Words past the
end of the video stay reachable. If words overlap, a **Clean timings (n)** button trims
the overlaps and removes duplicate words (undoable). Transcriptions and imports are
cleaned automatically.

**SRT import fixed.** Standard SRT files (`00:00:01,000 --> 00:00:02,400`, with spaces
around the arrow) imported zero words; they now import correctly.

**My Recent Projects (per user).** `src/lib/captions/projects-db.ts`, `projects.ts`,
`components/studio/ProjectsDialog.tsx`:

- every project has its own ID and is saved in its owner's folder:
  `creator:<email>`, `user:<login id>`, or `guest` on this device;
- the uploaded video/audio is saved with the project (IndexedDB), so reopening a recent
  project brings the picture back; reload opens the last project automatically;
- uploading a video on the demo creates a new project named after the file;
- folder actions: New project, Open, Rename, Duplicate (new ID, video copied), Delete,
  Download `.cutline` project file, Open `.cutline` file (imports under a new ID);
- signing in moves this device's guest projects into the account; signing out shows the
  guest folder only;
- `/studio?projects=1` opens the folder directly; the top bar shows Saving… / Saved;
- projects from the old shared list (`cutline.projects.v2`) are moved in once.

Storage is per browser. Moving a project to another computer: Download `.cutline` there
and Open it (re-attach the video). Cross-device sync needs a real database
(`DATABASE_URL`) plus Google login — the storage layer is written so a server backend can
be added behind the same functions.

## What changed

- **Transcription fixed and rebuilt for Roman Urdu.** The browser pulls the voice track
  out of the video (no more ffmpeg download), splits long files at quiet moments, and
  uploads compact Ogg/Opus chunks (~2 MB per 8 minutes — well under Vercel's 4.5 MB limit).
  The server tries xAI Grok STT → Groq Whisper → OpenAI Whisper, then an AI pass writes
  every word in Roman Urdu (`/api/romanize`). If no text model answers, an offline
  Urdu/Hindi → Roman converter (`src/lib/captions/roman.ts`) is used.
- **Server crash fixed.** The embedded database (PGLite) crashed the whole server when its
  data file was missing, which also broke `/api/transcribe`. It now logs and keeps running.
- **MP4 export** (`src/lib/captions/export-video.ts`): WebCodecs H.264 + AAC, faster than
  real time. Original size / 1080p / 720p buttons, frame-rate and quality options.
  Captions, colour grade and timeline cuts are burned in. Real-time recording fallback
  for browsers without WebCodecs.
- **Pro timeline:** captions / video (filmstrip) / audio (waveform) tracks, ruler, zoom
  (Ctrl + wheel, + / −), snapping, drag / trim / Alt-drag ripple, split (S), delete
  segments, restore cuts, audio extract (M4A / WAV), resizable height.
- **Caption engine** (`src/lib/captions/render.ts`): one canvas painter for preview,
  thumbnails and export. 47 templates (28 PRO), 18 motion presets, key-moments mode.
- **PRO + login:** PRO templates/motions show a crown and unlock with a free creator
  account during launch. Sign-ups are POSTed to `/api/signup`.
- **New gradient / 3D website** with features, motion picker, languages, two caption
  modes, templates, pricing (launch-free), FAQ.

## Environment variables

| Variable | Needed? | Purpose |
|---|---|---|
| `XAI_API_KEY` | Injected by the Grok platform | Grok Voice transcription + Roman Urdu AI pass |
| `GROQ_API_KEY` | Optional backup (free tier) | Whisper large-v3 transcription + romanizer |
| `OPENAI_API_KEY` | Optional backup | Whisper + romanizer |
| `TRANSCRIBE_PROVIDERS` | Optional | Order, e.g. `groq,xai` |
| `LEADS_WEBHOOK_URL` | Optional | Every creator sign-up is forwarded here (Google Apps Script, Zapier, Make, n8n…) |

## Quick edits

- Launch end date: `LAUNCH_FREE_UNTIL` / `LAUNCH_FREE_LABEL` in `src/lib/account.ts`.
- Logo: replace `public/logo.svg` (and `public/favicon.svg`).
- Which templates are PRO: `pro: true` in `src/lib/captions/templates.ts`.
- Which motions are PRO: `pro: true` in `ANIMATIONS` in `src/lib/captions/render.ts`.

## Browser notes

MP4 export is fastest in Chrome / Edge (Windows, macOS, Android). Safari 16.4+ and
Firefox 130+ also have WebCodecs. Older browsers fall back to real-time recording.
