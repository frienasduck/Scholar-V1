import { Info } from "lucide-react";

export function DevelopmentNotice({ children }: { children: React.ReactNode }) {
  return <aside className="scholar-development-notice" role="note"><Info aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-100" /><p>{children}</p></aside>;
}
