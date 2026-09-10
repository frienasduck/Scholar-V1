"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main role="alert" className="grid min-h-dvh place-items-center bg-background p-6"><div className="max-w-md space-y-5 text-center"><p className="text-xs tracking-[.25em] text-primary">SCHOLAR</p><h1 className="text-3xl font-semibold">We couldn't open this page</h1><p className="text-muted-foreground">Try again when your connection is ready. Your saved work has not been removed.</p><button onClick={reset} className="min-h-11 rounded-xl border border-border px-5">Try again</button></div></main>;
}
