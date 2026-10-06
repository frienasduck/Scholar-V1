"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { shouldIntentPrefetch } from "@/lib/navigation/intent-prefetch";

/** Preserve Link semantics and markup; warm only when the student shows intent. */
export function IntentLink({ onPointerEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter();
  const preload = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (typeof props.href === "string" && shouldIntentPrefetch(props.href, window.location.pathname, { hidden: document.hidden, ...connection })) router.prefetch(props.href);
  };
  return <Link {...props} prefetch={false} onPointerEnter={event => { onPointerEnter?.(event); if (event.pointerType === "mouse") preload(); }} onFocus={event => { onFocus?.(event); preload(); }}/>;
}
