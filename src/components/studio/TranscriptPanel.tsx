import { Button } from "@/components/ui/button";
import { seekTo, mediaBridge } from "@/lib/captions/media";
import { useStudio } from "@/lib/captions/store";
import { activeWord, formatTime } from "@/lib/captions/timing";
import type { Word } from "@/lib/captions/types";
import { CornerDownLeft, Plus, Search, Sparkles, Star } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

export function TranscriptPanel() {
  const words = useStudio((state) => state.project.words);
  const playhead = useStudio((state) => state.playhead);
  const selectedIds = useStudio((state) => state.selectedIds);
  const busy = useStudio((state) => state.busy);
  const progress = useStudio((state) => state.progress);
  const note = useStudio((state) => state.note);
  const [query, setQuery] = useState("");
  const active = activeWord(words, playhead)?.id ?? null;
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    if (!active || needle) return;
    document.getElementById(`word-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, needle]);

  const shown = needle ? words.filter((word) => word.text.toLowerCase().includes(needle)) : words;

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface/60 lg:border-r lg:border-white/5">
      <header className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">Transcript</h2>
          <p className="text-[11px] text-muted">{words.length} words · double-click to edit</p>
        </div>
        <div className="flex gap-1">
          <Button tone="ghost" size="xs" title="Shift every word earlier" onClick={() => useStudio.getState().nudgeAll(-0.1)}>
            −0.1s
          </Button>
          <Button tone="ghost" size="xs" title="Shift every word later" onClick={() => useStudio.getState().nudgeAll(0.1)}>
            +0.1s
          </Button>
        </div>
      </header>
      {busy ? (
        <div className="border-b border-white/5 px-3 py-2.5">
          <p className="flex items-center gap-2 text-xs font-medium text-accent-2">
            <Sparkles className="size-3.5 animate-pulse" />
            {busy}
          </p>
          {progress != null ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="border-b border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-muted">{note}</p> : null}
      <div className="border-b border-white/5 px-3 py-2">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-black/20 px-2 text-sm">
          <Search className="size-3.5 text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a word" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {words.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Sparkles className="mx-auto size-6 text-accent" />
            <p className="mt-2 text-sm font-medium">No words yet</p>
            <p className="mt-1 text-xs text-muted">Upload a video and press Transcribe, paste a script, or import an SRT.</p>
          </div>
        ) : (
          <ol>
            {shown.map((word) => (
              <Row key={word.id} word={word} active={word.id === active} selected={selected.has(word.id)} />
            ))}
          </ol>
        )}
      </div>
      <div className="flex gap-2 border-t border-white/5 p-2">
        <Button
          className="flex-1"
          size="sm"
          onClick={() => {
            const time = mediaBridge.video?.currentTime ?? useStudio.getState().playhead;
            useStudio.getState().addWordAt(time);
          }}
        >
          <Plus className="size-4" /> Add word at playhead
        </Button>
      </div>
    </section>
  );
}

const Row = memo(function Row({ word, active, selected }: { word: Word; active: boolean; selected: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word.text);
  const speakers = useStudio((state) => state.project.speakers);

  useEffect(() => setDraft(word.text), [word.text]);

  function seek(event?: React.MouseEvent) {
    useStudio.getState().select(word.id, Boolean(event?.shiftKey || event?.metaKey || event?.ctrlKey));
    seekTo(word.start);
    useStudio.getState().setPlayhead(word.start);
  }

  return (
    <li id={`word-${word.id}`} data-testid="word-row" className={`mx-1.5 rounded-lg ${selected ? "bg-accent/15 ring-1 ring-accent/50" : active ? "bg-white/[0.06]" : ""}`}>
      <div className="flex items-center gap-2 px-2 py-1">
        <button type="button" onClick={seek} className="w-12 shrink-0 text-left font-mono text-[11px] text-muted tabular-nums">
          {formatTime(word.start)}
        </button>
        {editing ? (
          <input
            autoFocus
            value={draft}
            className="min-w-0 flex-1 rounded-md border border-accent bg-black/40 px-2 py-1 text-sm outline-none"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              setEditing(false);
              useStudio.getState().editText(word.id, draft);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              if (event.key === "Escape") {
                setDraft(word.text);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={seek}
            onDoubleClick={() => setEditing(true)}
            className={`min-w-0 flex-1 truncate text-left text-sm ${active ? "font-semibold text-yellow-300" : "text-fg"}`}
          >
            {word.speaker != null ? (
              <span className="mr-1.5 rounded bg-white/10 px-1 text-[10px] text-muted">{speakers[String(word.speaker)] ?? `S${word.speaker + 1}`}</span>
            ) : null}
            {word.text}
            {word.emphasis ? <Star className="ml-1 inline size-3 fill-amber-400 text-amber-400" /> : null}
            {word.breakAfter ? <CornerDownLeft className="ml-1 inline size-3 text-muted" /> : null}
          </button>
        )}
      </div>
      {selected && !editing ? (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          <Button tone="ghost" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button tone="ghost" size="xs" onClick={() => useStudio.getState().updateWord(word.id, { emphasis: !word.emphasis })}>
            {word.emphasis ? "Unstar" : "★ Key word"}
          </Button>
          <Button tone="ghost" size="xs" onClick={() => useStudio.getState().updateWord(word.id, { breakAfter: !word.breakAfter })}>
            {word.breakAfter ? "No break" : "Line break"}
          </Button>
          <Button tone="ghost" size="xs" onClick={() => useStudio.getState().splitWord(word.id)}>
            Split
          </Button>
          <Button tone="ghost" size="xs" onClick={() => useStudio.getState().joinWord(word.id)}>
            Join next
          </Button>
          <Button tone="ghost" size="xs" className="text-rose-300" onClick={() => useStudio.getState().removeWord(word.id)}>
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  );
});
