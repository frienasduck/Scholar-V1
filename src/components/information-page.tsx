import Link from "next/link";
import { ScholarFooter } from "@/components/scholar-footer";
export function InformationPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground"><header className="border-b border-border px-6 py-5"><Link href="/" className="font-semibold tracking-[.15em]">SCHOLAR</Link></header><main className="mx-auto max-w-3xl px-6 py-14"><p className="text-xs uppercase tracking-widest text-primary">Your study workspace</p><h1 className="mt-4 font-serif text-4xl sm:text-5xl">{title}</h1><p className="mt-5 text-lg leading-8 text-muted-foreground">{intro}</p><div className="mt-10 space-y-8 text-sm leading-7 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline [&_p]:text-muted-foreground">{children}</div></main><ScholarFooter compact /></div>;
}
