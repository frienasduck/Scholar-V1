"use client";

import { useEffect, type CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { announceScholarNotification } from "@/lib/notifications/notification-api";
import type { ScholarNotificationEventDetail } from "@/lib/notifications/notification-types";
import { useStore } from "@/lib/store";
import "./scholar-notifications.css";

export function ScholarNotificationProvider(props: ToasterProps) {
  const size = useStore((state) => state.settings.notificationSize ?? 100);
  const position = useStore((state) => state.settings.notificationPosition ?? "top-left");
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<ScholarNotificationEventDetail>).detail;
      if (!detail?.type || !detail.title) return;
      announceScholarNotification(detail);
    };
    window.addEventListener("scholar:notification", listener);
    return () => window.removeEventListener("scholar:notification", listener);
  }, []);

  return (
    <Sonner
      {...props}
      className="scholar-notification-viewport"
      position={position}
      style={{ "--notification-scale": String(Math.max(0.75, Math.min(1.25, size / 100))) } as CSSProperties}
      offset={{ top: 84, right: 20, bottom: 20, left: 20 }}
      mobileOffset={{ top: "calc(max(12px, env(safe-area-inset-top)) + 116px)", right: 12, left: 12 }}
      visibleToasts={3}
      gap={12}
      expand={false}
      closeButton={false}
      richColors={false}
      containerAriaLabel="Scholar notifications"
      swipeDirections={["right", "top"]}
    />
  );
}
