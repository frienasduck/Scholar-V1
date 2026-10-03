"use client";
import { useScholarAccess } from "./subscription-provider";
import { PlusFeaturePreview, type PreviewProps } from "./plus-feature-preview";
export function PlusGate({ children, ...props }: PreviewProps & { children: React.ReactNode }) {
  const access = useScholarAccess();
  if (access.loading) return <div role="status" aria-label="Checking access" className="min-h-48 animate-pulse rounded-3xl border border-white/10 bg-white/5" />;
  return access.has(props.entitlement) ? <>{children}</> : <PlusFeaturePreview {...props} />;
}
