"use client";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { useStore } from "@/lib/store";
import type { ResourceResult } from "@/lib/resources/types";
export function ResourceSearchCommands({ query, onNavigate }: { query: string; onNavigate: () => void }) {
  const grade = useStore(s => s.user.scholarClass); const identity = useStore(s => `${s.authed}:${s.guestMode}:${s.user.email}`);
  const [results, setResults] = useState<{ identity: string; query: string; resources: ResourceResult["resources"] } | null>(null);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { void fetch(`/api/resources?${new URLSearchParams({ q: query.slice(0, 160), grade: String(grade), limit: "5" })}`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (data) setResults({ identity, query, resources: data.resources }); }).catch(() => {}); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, grade, identity]);
  if (results?.identity !== identity || results.query !== query || !results.resources.length) return null;
  return <CommandGroup heading="Indexed study resources">{results.resources.map(resource => <CommandItem key={resource.id} value={`${resource.id} ${query}`} onSelect={() => { try { sessionStorage.setItem("scholar:resources:target", JSON.stringify({ q: query, resourceId: resource.id })); } catch {} onNavigate(); }}><BookOpen className="mr-2 size-4"/><span>{resource.title}<small className="ml-2 opacity-60">{resource.publisher} · {resource.visibility === "PRIVATE" ? "Private" : "Built-in"}</small></span></CommandItem>)}</CommandGroup>;
}
