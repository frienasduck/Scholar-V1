/** One observer for animated instances; static gallery/history skip it. */
let observer: IntersectionObserver | null = null;
const callbacks = new Map<Element, (visible: boolean) => void>();
export function observeLamVisibility(element: Element, onChange: (visible: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  observer ??= new IntersectionObserver(entries => { for (const entry of entries) callbacks.get(entry.target)?.(entry.isIntersecting); }, { rootMargin: "24px", threshold: 0 });
  callbacks.set(element, onChange); observer.observe(element);
  return () => { callbacks.delete(element); observer?.unobserve(element); if (!callbacks.size) { observer?.disconnect(); observer = null; } };
}
