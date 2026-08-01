"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CircleAlert, Info, LoaderCircle, X } from "lucide-react";
import type { ScholarNotificationRecord } from "@/lib/notifications/notification-types";
import { useStore } from "@/lib/store";

const TYPE_LABELS = {
  success: "Success",
  info: "Information",
  warning: "Warning",
  error: "Error",
  loading: "Loading",
  progress: "Progress",
} as const;

function NotificationIcon({ type }: Pick<ScholarNotificationRecord, "type">) {
  if (type === "success") return <Check aria-hidden="true" />;
  if (type === "warning") return <AlertTriangle aria-hidden="true" />;
  if (type === "error") return <CircleAlert aria-hidden="true" />;
  if (type === "loading" || type === "progress") return <LoaderCircle aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

export function ScholarNotification({
  notification,
  onRequestClose,
}: {
  notification: ScholarNotificationRecord;
  onRequestClose: () => void;
}) {
  const preferredDuration = useStore((state) => state.settings.notificationTimeout ?? 2000);
  const duration = notification.duration ?? (notification.type === "loading" || notification.type === "progress" ? Infinity : preferredDuration);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (!Number.isFinite(remaining.current) || remaining.current <= 0) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(onRequestClose, remaining.current);
  }, [clearTimer, onRequestClose]);

  useEffect(() => {
    remaining.current = duration;
    startTimer();
    return clearTimer;
  }, [clearTimer, duration, startTimer]);

  const pause = () => {
    if (paused || !Number.isFinite(remaining.current)) return;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    clearTimer();
    setPaused(true);
  };

  const resume = () => {
    if (!paused) return;
    setPaused(false);
    startTimer();
  };

  const close = () => {
    onRequestClose();
  };

  const progress = typeof notification.progress === "number"
    ? Math.max(0, Math.min(100, notification.progress))
    : undefined;
  const urgent = notification.type === "error";
  const message = notification.message ?? notification.description;

  return (
    <article
      className="scholar-notification"
      data-notification-type={notification.type}
      data-paused={paused}
      data-testid="scholar-notification"
      role={urgent ? "alert" : "status"}
      aria-live={notification.type === "progress" ? "off" : urgent ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resume();
      }}
    >
      <div className="scholar-notification-glass" aria-hidden="true" />
      <div className="scholar-notification-tint" aria-hidden="true" />
      <div className="scholar-notification-specular" aria-hidden="true" />
      <div className="scholar-notification-edge" aria-hidden="true" />
      <div className="scholar-notification-grain" aria-hidden="true" />

      <div className="scholar-notification-content">
        <span className="scholar-notification-icon"><NotificationIcon type={notification.type} /></span>
        <div className="scholar-notification-copy">
          <span className="sr-only">{TYPE_LABELS[notification.type]}. </span>
          <strong>{notification.title}</strong>
          {message ? <p>{message}</p> : null}
          {progress !== undefined ? (
            <div className="scholar-notification-progress" aria-label={`${Math.round(progress)} percent complete`}>
              <i style={{ width: `${progress}%` }} />
              <span>{Math.round(progress)}%</span>
            </div>
          ) : null}
        </div>
        {notification.action ? (
          <button
            type="button"
            className="scholar-notification-action"
            onClick={() => {
              notification.action?.onClick();
              close();
            }}
          >
            {notification.action.label}
          </button>
        ) : null}
      </div>

      {notification.dismissible !== false ? (
        <button
          type="button"
          className="scholar-notification-close"
          onClick={close}
          aria-label="Dismiss notification"
          title="Dismiss notification"
        >
          <X aria-hidden="true" />
        </button>
      ) : null}

      {Number.isFinite(duration) && progress === undefined ? (
        <span
          className="scholar-notification-lifetime"
          aria-hidden="true"
          style={{ animationDuration: `${duration}ms` }}
        />
      ) : null}
    </article>
  );
}
