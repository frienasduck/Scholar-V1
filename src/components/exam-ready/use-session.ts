"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { actionSchema, restoreMissionCoverage, setupSchema, storedSetupSchema, type Action, type ExamSession, type Setup } from "@/lib/exam-ready/model";
import { createSession, transition } from "@/lib/exam-ready/planner";
export async function examRequest(url: string, body?: unknown, method = "POST") {
    const r = await fetch(url, { method: body === undefined ? "GET" : method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(58000) });
    const value = await r.json();
    if (!r.ok)
        throw new Error(value.message ?? "This action could not be completed. Your session is preserved.");
    return value;
}
type Cached = {
    sessions: ExamSession[];
    queue: {
        id: string;
        revision: number;
        action: Action;
    }[];
};
function readCache(key: string): Cached { try {
    const c = JSON.parse(localStorage.getItem(key) ?? "{}");
    return { sessions: Array.isArray(c.sessions) ? c.sessions.filter((s: ExamSession) => storedSetupSchema.safeParse(s.setup).success && Array.isArray(s.tasks) && s.clock && Array.isArray(s.attempts)).slice(0, 30).map(restoreMissionCoverage) : [], queue: Array.isArray(c.queue) ? c.queue.filter((q: {
            action: Action;
        }) => actionSchema.safeParse(q.action).success).slice(0, 60) : [] };
}
catch {
    return { sessions: [], queue: [] };
} }
export function useExamSessions(scope: string, grade: 9 | 11, guest: boolean) {
    const key = `scholar:exam-ready:v1:${scope}:${grade}`;
    const [sessions, setSessions] = useState<ExamSession[]>([]), [queue, setQueue] = useState<Cached["queue"]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [offline, setOffline] = useState(false), [access, setAccess] = useState<{
        allowed: boolean;
        source: string;
        freeUntil: string | null;
    } | null>(null);
    const cache = useRef<Cached>({ sessions: [], queue: [] }), generation = useRef(0), inFlight = useRef(false);
    const store = useCallback((next: Cached) => { cache.current = next; setSessions(next.sessions); setQueue(next.queue); try {
        localStorage.setItem(key, JSON.stringify(next));
    }
    catch {
        setError("Device storage is full. Keep this tab open and save important notes to Scholar Notes.");
    } }, [key]);
    useEffect(() => {
        let cancelled = false;
        const c = readCache(key);
        cache.current = c;
        const frame = requestAnimationFrame(() => { if (!cancelled) {
            setSessions(c.sessions);
            setQueue(c.queue);
            setOffline(!navigator.onLine);
        } });
        examRequest("/api/exam-ready").then(v => { if (cancelled)
            return; setAccess(v.access); if (!guest && !c.queue.length)
            store({ sessions: v.sessions, queue: [] }); }).catch(e => { if (!cancelled)
            setError(e.message); }).finally(() => { if (!cancelled)
            setLoading(false); });
        const network = () => setOffline(!navigator.onLine);
        window.addEventListener("online", network);
        window.addEventListener("offline", network);
        return () => { cancelled = true; generation.current++; cancelAnimationFrame(frame); window.removeEventListener("online", network); window.removeEventListener("offline", network); };
    }, [key, guest, store]);
    const replace = useCallback((s: ExamSession) => store({ ...cache.current, sessions: [s, ...cache.current.sessions.filter(x => x.id !== s.id)].slice(0, 30) }), [store]);
    async function run<T>(fn: () => Promise<T>): Promise<T | undefined> { if (inFlight.current) return undefined; inFlight.current = true; setBusy(true); setError(""); const token = generation.current; try {
        const result = await fn();
        return token === generation.current ? result : undefined;
    }
    catch (e) {
        if (token === generation.current)
            setError(e instanceof Error ? e.message : "This action failed. Retry safely.");
    }
    finally {
        inFlight.current = false;
        if (token === generation.current)
            setBusy(false);
    } }
    const start = (setup: Setup) => run(async () => { const parsed = setupSchema.parse(setup); if (!access?.allowed)
        throw new Error("Exam Ready access has not been verified. Reconnect and retry."); const s = guest ? createSession(crypto.randomUUID(), parsed) : (await examRequest("/api/exam-ready", parsed)).session as ExamSession; replace(s); return s; });
    const act = (s: ExamSession, action: Action) => run(async () => {
        if (guest) {
            if (action.type === "answer")
                throw new Error("Sign in for teacher questions and verified evaluations.");
            const next = transition(s, action);
            next.revision++;
            replace(next);
            return next;
        }
        if (!navigator.onLine) {
            if (action.type === "answer" || action.type === "settings" || action.type === "replan")
                throw new Error("Reconnect for evaluated answers and plan changes. Notes, pause and checklist edits remain available offline.");
            if (cache.current.queue.length >= 60)
                throw new Error("Reconnect to sync your pending changes.");
            const next = transition(s, action);
            next.revision++;
            store({ sessions: [next, ...cache.current.sessions.filter(x => x.id !== s.id)], queue: [...cache.current.queue, { id: s.id, revision: s.revision, action }] });
            return next;
        }
        if (cache.current.queue.length)
            throw new Error("Sync your pending changes first.");
        const next = (await examRequest(`/api/exam-ready/${s.id}`, { revision: s.revision, action }, "PATCH")).session as ExamSession;
        replace(next);
        return next;
    });
    const teacher = (s: ExamSession, pace: string, question = "") => run(async () => { if (guest)
        throw new Error("Sign in to use the AI teacher. Your guest plan and notes will stay on this device."); if (cache.current.queue.length)
        throw new Error("Sync pending changes before asking the teacher."); const v = await examRequest(`/api/exam-ready/${s.id}/teacher`, { revision: s.revision, pace, question }); replace(v.session); return v.key as string; });
    const reload = (id: string) => run(async () => { if (cache.current.queue.length)
        throw new Error("Pending local changes are retained. Sync them before loading another device’s version."); const s = (await examRequest(`/api/exam-ready/${id}`)).session as ExamSession; replace(s); return s; });
    const sync = () => run(async () => { let pending = [...cache.current.queue]; while (pending.length) {
        const q = pending[0], v = await examRequest(`/api/exam-ready/${q.id}`, { revision: q.revision, action: q.action }, "PATCH");
        pending = pending.slice(1);
        store({ sessions: [v.session, ...cache.current.sessions.filter(x => x.id !== q.id)], queue: pending });
    } return true; });
    const recover = (id: string) => run(async () => {
        // Only an explicit user action replaces a conflicting local plan. Keep a
        // separate recoverable copy before dropping this session's queued edits.
        const local = cache.current.sessions.find(s => s.id === id);
        if (local)
            localStorage.setItem(`${key}:recovery:${id}`, JSON.stringify({ session: local, queue: cache.current.queue.filter(q => q.id === id) }));
        const saved = (await examRequest(`/api/exam-ready/${id}`)).session as ExamSession;
        store({ sessions: [saved, ...cache.current.sessions.filter(s => s.id !== id)], queue: cache.current.queue.filter(q => q.id !== id) });
        return saved;
    });
    return { sessions, loading, busy, error, offline, access, queue, start, act, teacher, reload, sync, recover, replace };
}
