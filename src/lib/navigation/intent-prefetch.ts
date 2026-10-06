export function shouldIntentPrefetch(href: string, currentPath: string, options: { hidden?: boolean; saveData?: boolean; effectiveType?: string } = {}): boolean {
  return /^\/(?!\/)/.test(href) && href !== currentPath && !options.hidden && !options.saveData && !["slow-2g", "2g", "3g"].includes(options.effectiveType ?? "");
}
