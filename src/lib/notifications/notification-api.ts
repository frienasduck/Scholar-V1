"use client";

import { createElement, isValidElement, type ReactNode } from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";
import { ScholarNotification } from "@/components/notifications/scholar-notification";
import type {
  ScholarNotificationAction,
  ScholarNotificationEventDetail,
  ScholarNotificationOptions,
  ScholarNotificationRecord,
  ScholarNotificationType,
} from "@/lib/notifications/notification-types";

const records = new Map<string | number, ScholarNotificationRecord>();
const recent = new Map<string, { id: string | number; at: number }>();
const MAX_RECORDS = 80;
const DEDUPE_WINDOW = 1_200;

function nextId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `scholar-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function textKey(value: ReactNode): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "rich-content";
}

function trimRecords() {
  if (records.size <= MAX_RECORDS) return;
  const oldest = records.keys().next().value;
  if (oldest !== undefined) records.delete(oldest);
}

function dismiss(id?: string | number) {
  if (id !== undefined) records.delete(id);
  else records.clear();
  return sonnerToast.dismiss(id);
}

function render(record: ScholarNotificationRecord) {
  records.set(record.id, record);
  trimRecords();
  return sonnerToast.custom(
    (toastId) => createElement(ScholarNotification, {
      notification: { ...record, id: toastId },
      onRequestClose: () => dismiss(toastId),
    }),
    {
      id: record.id,
      duration: Infinity,
      dismissible: true,
      position: record.position,
      unstyled: true,
      className: "scholar-notification-host",
      onDismiss: () => {
        records.delete(record.id);
        record.onDismiss?.();
      },
      onAutoClose: () => records.delete(record.id),
    },
  );
}

function show(type: ScholarNotificationType, title: ReactNode, options: ScholarNotificationOptions = {}) {
  const message = options.message ?? options.description;
  const key = `${type}:${textKey(title)}:${textKey(message)}`;
  const duplicate = recent.get(key);
  const now = Date.now();
  const id = options.id ?? (duplicate && now - duplicate.at < DEDUPE_WINDOW ? duplicate.id : nextId());
  recent.set(key, { id, at: now });
  window.setTimeout(() => {
    if (recent.get(key)?.id === id) recent.delete(key);
  }, DEDUPE_WINDOW + 50);
  return render({ ...options, id, type, title, message });
}

function update(id: string | number, updates: Partial<Omit<ScholarNotificationRecord, "id">>) {
  const current = records.get(id);
  if (!current) return id;
  return render({ ...current, ...updates, id });
}

export const notify = {
  success: (title: ReactNode, options?: ScholarNotificationOptions) => show("success", title, options),
  info: (title: ReactNode, options?: ScholarNotificationOptions) => show("info", title, options),
  warning: (title: ReactNode, options?: ScholarNotificationOptions) => show("warning", title, options),
  error: (title: ReactNode, options?: ScholarNotificationOptions) => show("error", title, options),
  loading: (title: ReactNode, options?: ScholarNotificationOptions) => show("loading", title, { dismissible: false, ...options, duration: options?.duration ?? Infinity }),
  progress: (title: ReactNode, options?: ScholarNotificationOptions) => show("progress", title, { ...options, duration: options?.duration ?? Infinity }),
  update,
  dismiss,
};

function resolveNode(value: ExternalToast["description"]): ReactNode {
  return typeof value === "function" ? value() : value;
}

function resolveAction(action: ExternalToast["action"]): ScholarNotificationAction | undefined {
  if (!action || isValidElement(action) || typeof action !== "object" || !("label" in action) || !("onClick" in action)) return undefined;
  return {
    label: action.label,
    onClick: action.onClick as () => void,
  };
}

function compatibleOptions(options?: ExternalToast): ScholarNotificationOptions {
  const supportedPositions = new Set(["top-left", "top-right", "top-center", "bottom-left", "bottom-right", "bottom-center"]);
  return {
    id: options?.id,
    description: resolveNode(options?.description),
    duration: options?.duration,
    dismissible: options?.dismissible,
    action: resolveAction(options?.action),
    position: options?.position && supportedPositions.has(options.position) ? options.position as ScholarNotificationOptions["position"] : undefined,
    onDismiss: options?.onDismiss ? () => options.onDismiss?.({ id: options.id ?? "", title: "" }) : undefined,
  };
}

type CompatibleToast = ((title: ReactNode, options?: ExternalToast) => string | number) & {
  success: (title: ReactNode, options?: ExternalToast) => string | number;
  info: (title: ReactNode, options?: ExternalToast) => string | number;
  warning: (title: ReactNode, options?: ExternalToast) => string | number;
  error: (title: ReactNode, options?: ExternalToast) => string | number;
  loading: (title: ReactNode, options?: ExternalToast) => string | number;
  dismiss: (id?: string | number) => string | number;
};

export const toast = Object.assign(
  (title: ReactNode, options?: ExternalToast) => notify.info(title, compatibleOptions(options)),
  {
    success: (title: ReactNode, options?: ExternalToast) => notify.success(title, compatibleOptions(options)),
    info: (title: ReactNode, options?: ExternalToast) => notify.info(title, compatibleOptions(options)),
    warning: (title: ReactNode, options?: ExternalToast) => notify.warning(title, compatibleOptions(options)),
    error: (title: ReactNode, options?: ExternalToast) => notify.error(title, compatibleOptions(options)),
    loading: (title: ReactNode, options?: ExternalToast) => notify.loading(title, compatibleOptions(options)),
    dismiss,
  },
) as CompatibleToast;

export function announceScholarNotification(detail: ScholarNotificationEventDetail) {
  return show(detail.type, detail.title, detail);
}
