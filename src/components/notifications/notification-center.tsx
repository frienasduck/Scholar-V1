"use client";

import { useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { clearNotificationHistory, setNotificationHistoryOwner, useNotificationHistory } from "@/lib/notifications/notification-api";
import "./notification-center.css";

export function NotificationCenter() {
  const access = useScholarAccess();
  const history = useNotificationHistory();
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  const owner = access.user?.id ?? "guest";
  useEffect(() => { setNotificationHistoryOwner(owner); }, [owner]);
  const unread = history.filter((entry) => entry.at > seenAt).length;
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setSeenAt(Date.now()); }}>
    <PopoverTrigger asChild><button type="button" className="scholar-notification-center-trigger" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`} title="Notifications"><Bell className="size-4" />{unread > 0 ? <span className="scholar-notification-center-count">{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</span> : null}</button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={12} className="scholar-notification-center">
      <div className="scholar-notification-center-head"><div><h2>Notifications</h2><p>Recent Scholar activity on this device</p></div>{history.length ? <button type="button" onClick={clearNotificationHistory} aria-label="Clear notification history" title="Clear history"><Trash2 className="size-4" /></button> : null}</div>
      <div className="scholar-notification-center-list">{history.length ? history.map((entry) => <article key={entry.id} data-type={entry.type}><span className="scholar-notification-center-dot" /><div><strong>{entry.title}</strong>{entry.message ? <p>{entry.message}</p> : null}<time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleString()}</time></div></article>) : <p className="scholar-notification-center-empty">You’re all caught up.</p>}</div>
    </PopoverContent>
  </Popover>;
}
