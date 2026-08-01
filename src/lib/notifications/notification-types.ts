import type { ReactNode } from "react";

export type ScholarNotificationType =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "loading"
  | "progress";

export type ScholarNotificationPosition =
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

export type ScholarNotificationAction = {
  label: ReactNode;
  onClick: () => void;
};

export type ScholarNotificationOptions = {
  id?: string | number;
  description?: ReactNode;
  message?: ReactNode;
  duration?: number;
  dismissible?: boolean;
  action?: ScholarNotificationAction;
  progress?: number;
  position?: ScholarNotificationPosition;
  onDismiss?: () => void;
};

export type ScholarNotificationRecord = ScholarNotificationOptions & {
  id: string | number;
  type: ScholarNotificationType;
  title: ReactNode;
};

export type ScholarNotificationEventDetail = Omit<ScholarNotificationRecord, "id"> & {
  id?: string | number;
};
