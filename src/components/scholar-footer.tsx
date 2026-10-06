import { IntentLink as Link } from "@/components/navigation/intent-link";
import { useId } from "react";
import { GraduationCap, MessageCircle, Play, Sparkles, UsersRound } from "lucide-react";
import styles from "./scholar-footer.module.css";

const groups = [
  { title: "Product", links: [["AI Tools", "/ai-tools"], ["E-Books", "/ebook"], ["Study Plan", "/planner"], ["Canvas", "/canvas"], ["Experiments", "/lab"]] },
  { title: "Resources", links: [["Study", "/study"], ["AI Tutor", "/ai-tutor"], ["Quiz", "/quiz"], ["Flashcards", "/flashcards"], ["Help Center", "/help"]] },
  { title: "Your Scholar", links: [["Settings & profile", "/settings"], ["Scholar Plus", "/plus"], ["Notes", "/notes"], ["Files", "/files"], ["Reminders", "/reminders"], ["Changelog", "/updates"]] },
  { title: "Legal", links: [["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"], ["Help & feedback", "/help"]] },
];

export function ScholarFooter({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, "");

  return (
    <footer className={`scholar-info-footer ${styles.footer} ${compact ? styles.compact : ""}`} aria-label="Scholar footer">
      {!compact && <div className={styles.atmosphere} aria-hidden="true"><span /><span /></div>}
      <div className={styles.shell}>
        {!compact && <>
          <svg className={styles.rim} viewBox="0 0 1600 440" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-glass`} x1="0" y1="0" x2=".2" y2="1">
                <stop offset="0" stopColor="#879ccf" stopOpacity=".22" />
                <stop offset=".55" stopColor="#111729" stopOpacity=".36" />
                <stop offset="1" stopColor="#6978bd" stopOpacity=".22" />
              </linearGradient>
              <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2=".6">
                <stop stopColor="#cadcff" stopOpacity=".7" />
                <stop offset=".23" stopColor="#788bca" stopOpacity=".3" />
                <stop offset=".48" stopColor="#dcc9ff" stopOpacity=".95" />
                <stop offset=".72" stopColor="#8eafff" stopOpacity=".35" />
                <stop offset="1" stopColor="#c4bdff" stopOpacity=".8" />
              </linearGradient>
            </defs>
            <path d="M 68 57 H 651 C 728 57 724 4 800 4 C 876 4 872 57 949 57 H 1532 C 1578 57 1597 91 1597 137 V 371 Q 1597 437 1531 437 H 69 Q 3 437 3 371 V 137 C 3 91 22 57 68 57 Z" fill={`url(#${id}-glass)`} stroke={`url(#${id}-rim)`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className={styles.orb} aria-hidden="true"><span /></div>
          <div className={styles.main}>
            <div className={styles.brand}>
              <Link href="/" className={styles.wordmark} aria-label="Scholar home">scholar<Sparkles aria-hidden="true" /></Link>
              <p>Your AI study companion,<br />built for a brighter you.</p>
              <nav className={styles.shortcuts} aria-label="Scholar quick links">
                <Link href="/lamtube" aria-label="Watch lessons on LAMTube" title="LAMTube"><Play aria-hidden="true" /></Link>
                <Link href="/group-study" aria-label="Group Study" title="Group Study"><UsersRound aria-hidden="true" /></Link>
                <Link href="/help" aria-label="Help and feedback" title="Help & feedback"><MessageCircle aria-hidden="true" /></Link>
              </nav>
            </div>
            {groups.map((group) => <nav key={group.title} className={styles.group} aria-label={group.title + " footer"}>
              <h2>{group.title}</h2>
              <ul>{group.links.map(([label, href]) => <li key={href}><Link href={href}>{label}{href === "/canvas" && <span className={styles.beta}>Early Beta</span>}</Link></li>)}</ul>
            </nav>)}
            <div className={styles.statement}><Sparkles aria-hidden="true" /><p>Better students.<br />Brighter tomorrows.</p></div>
          </div>
        </>}
        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} Scholar. All rights reserved.</p>
          {compact ? <nav aria-label="Information"><Link href="/privacy">Privacy</Link><Link href="/terms">Using Scholar</Link><Link href="/help">Support</Link></nav>
            : <span className={styles.signature}><GraduationCap aria-hidden="true" /> Made for your next breakthrough.</span>}
        </div>
      </div>
    </footer>
  );
}
