import Link from "next/link";
export default function NotFound() {
  return <main className="grid min-h-dvh place-items-center bg-background p-6"><div className="max-w-md space-y-5 text-center"><p className="text-xs tracking-[.25em] text-primary">SCHOLAR · 404</p><h1 className="font-serif text-4xl">This page isn't here</h1><p className="text-muted-foreground">The link may be outdated. Your study workspace is still available.</p><Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-primary-foreground">Open Scholar</Link></div></main>;
}
