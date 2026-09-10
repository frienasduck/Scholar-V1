import Link from "next/link";
import { GraduationCap } from "lucide-react";

const groups = [
  { title: "Learn", links: [["Study", "/study"], ["AI Tutor", "/ai-tutor"], ["Quiz", "/quiz"], ["Flashcards", "/flashcards"]] },
  { title: "Organize", links: [["Notes", "/notes"], ["Planner", "/planner"], ["Files", "/files"], ["Reminders", "/reminders"]] },
  { title: "Your Scholar", links: [["Settings & profile", "/settings"], ["Scholar Plus", "/plus"], ["Help & feedback", "/help"], ["What's new", "/updates"]] },
];

export function ScholarFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="scholar-info-footer mt-12 border-t border-white/10 bg-background/85 px-5 py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] text-sm lg:pb-8">
      <div className="mx-auto max-w-6xl">
        {!compact && <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="flex items-center gap-2 font-semibold tracking-wide"><GraduationCap className="h-5 w-5 text-primary" /> SCHOLAR</div><p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">A clearer place to learn, practise, and plan your next step.</p></div>
          {groups.map((group) => <nav key={group.title} aria-label={group.title + " footer"}><h2 className="mb-2 font-medium">{group.title}</h2><ul className="space-y-1">{group.links.map(([label, href]) => <li key={href}><Link href={href} className="inline-flex min-h-10 items-center text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{label}</Link></li>)}</ul></nav>)}
        </div>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Scholar</p>
          <nav aria-label="Information" className="flex flex-wrap gap-5"><Link href="/privacy" className="py-2 hover:text-foreground">Privacy</Link><Link href="/terms" className="py-2 hover:text-foreground">Using Scholar</Link><Link href="/help" className="py-2 hover:text-foreground">Support</Link></nav>
        </div>
      </div>
    </footer>
  );
}
