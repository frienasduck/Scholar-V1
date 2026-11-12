"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BookOpen, Search, X, ArrowUpRight } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { useResourceSearch } from "@/components/resources/use-resource-search";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  SCHOLAR_SEARCH_ALIASES,
  searchScholarAliases,
  setLamPluginTarget,
  setSettingsTarget,
  setWorkspaceMode,
} from "@/lib/shrinking-scholar";

type Result = {
  id: string;
  label: string;
  detail: string;
  destination: string;
  mode?: string;
  settingsCategory?: string;
  pluginId?: string;
  bookId?: string;
  resourceId?: string;
};

const CURATED = [
  "question-practice:practice",
  "doubt-lab:history",
  "experiment-lab:experiments",
  "study-media:lamtube",
  "lam-ai:chat",
  "resources:library",
  "settings:intelligence",
];

export function InlineSearch({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const grade = useStore((s) => s.user.scholarClass);
  const lookup = useResourceSearch(query, open);

  const local = useMemo<Result[]>(() => {
    const q = query.trim();
    const aliases = q
      ? searchScholarAliases(q, 10)
      : CURATED.map((curatedId) => SCHOLAR_SEARCH_ALIASES.find((alias) => alias.id === curatedId)).filter((alias) => Boolean(alias)) as typeof SCHOLAR_SEARCH_ALIASES;
    const results: Result[] = aliases.map((alias) => ({
      id: `alias:${alias.id}`,
      label: alias.label,
      detail: alias.detail,
      destination: alias.viewId,
      mode: alias.mode,
      settingsCategory: alias.settingsCategory,
      pluginId: alias.pluginId,
    }));

    // Keep the rest of Scholar discoverable without duplicating merged modes.
    const covered = new Set(SCHOLAR_SEARCH_ALIASES.map((alias) => alias.viewId));
    const extra = NAV_ITEMS
      .filter((item) => !item.preview && !covered.has(item.id))
      .filter((item) => !q || item.label.toLowerCase().includes(q.toLowerCase()))
      .slice(0, q ? 4 : 0)
      .map<Result>((item) => ({
        id: `page:${item.id}`,
        label: item.label,
        detail: "Scholar section",
        destination: item.id,
      }));

    if (grade === 11) {
      results.push(
        { id: "book:chemistry", label: "Chemistry Part 1", detail: "E-Book · Some Basic Concepts · Structure of Atom", destination: "ebook", bookId: "chemistry-pt1" },
        { id: "book:maths", label: "Mathematics Part 1", detail: "E-Book · Sets · Relations and Functions", destination: "ebook", bookId: "maths-pt1" },
      );
    }
    if (!q) {
      results.push(
        { id: "action:focus", label: "Start Focus Timer", detail: "Focus · timer", destination: "focus" },
      );
    }

    return [...results, ...extra].slice(0, q ? 12 : 8);
  }, [grade, query]);

  const results: Result[] = [
    ...local,
    ...lookup.resources.map((resource) => ({
      id: `resource:${resource.id}`,
      label: resource.title,
      detail: `Resources · ${resource.publisher} · ${resource.visibility === "PRIVATE" ? "Private" : "Built-in"}`,
      destination: "resources",
      mode: "library",
      resourceId: resource.id,
    })),
  ];
  const selected = Math.min(index, Math.max(0, results.length - 1));

  const choose = (result: Result) => {
    try {
      if (result.mode) setWorkspaceMode(result.destination, result.mode);
      if (result.settingsCategory) setSettingsTarget(result.settingsCategory);
      if (result.pluginId) setLamPluginTarget(result.pluginId, query.trim());
      if (result.bookId) {
        sessionStorage.setItem("scholar:ebook:target", JSON.stringify({ bookId: result.bookId, destination: "Reader" }));
      }
      if (result.resourceId) {
        sessionStorage.setItem("scholar:resources:target", JSON.stringify({ q: query, resourceId: result.resourceId }));
      }
    } catch { /* storage is optional */ }
    setOpen(false);
    onNavigate(result.destination);
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected, open, id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="scholar-top-search sg-inline-search" data-search-open={open}>
          <button
            type="button"
            aria-label="Open Scholar search"
            className="grid size-11 shrink-0 place-items-center lg:size-7"
            onClick={() => {
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
          <input
            ref={inputRef}
            aria-label="Search Scholar"
            placeholder="Search Scholar…"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-results`}
            aria-activedescendant={open && results.length ? `${id}-option-${selected}` : undefined}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setIndex(0); setOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setIndex((current) => Math.max(0, Math.min(results.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
              } else if (event.key === "Enter" && open && results.length) {
                event.preventDefault();
                choose(results[selected]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              } else if (event.key === "Tab") setOpen(false);
            }}
          />
          {open ? (
            <button type="button" aria-label="Close search suggestions" className="grid size-11 shrink-0 place-items-center lg:size-7" onClick={() => setOpen(false)}><X className="size-4" /></button>
          ) : <kbd aria-hidden="true">⌘ K</kbd>}
        </div>
      </PopoverAnchor>
      <PopoverContent
        id={`${id}-results`}
        role="listbox"
        aria-label="Search results"
        side="bottom"
        align="start"
        sideOffset={8}
        className="sg-inline-results"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => { if (anchorRef.current?.contains(event.target as Node)) event.preventDefault(); }}
      >
        <p className="sg-search-caption">
          {query.trim() ? "Destinations and available study sources" : "Merged destinations and study tools"}
        </p>
        {results.map((result, optionIndex) => (
          <button
            type="button"
            role="option"
            id={`${id}-option-${optionIndex}`}
            key={result.id}
            aria-selected={optionIndex === selected}
            tabIndex={-1}
            className="sg-inline-option"
            onPointerMove={() => setIndex(optionIndex)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(result)}
          >
            <BookOpen className="size-4" />
            <span><strong>{result.label}</strong><small>{result.detail}</small></span>
            <ArrowUpRight className="size-4" />
          </button>
        ))}
        {!results.length && (
          <p className="sg-search-status">No matching destinations. Try a workspace, a mode, or a source title.</p>
        )}
        <p role="status" className="sg-search-status">
          {lookup.status === "loading"
            ? "Searching available study sources…"
            : lookup.status === "error"
              ? "Resource lookup unavailable. Local destinations still work."
              : "Results always show their merged destination and mode. Use ↑ ↓ and Enter."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
