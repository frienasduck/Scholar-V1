import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  Sparkles,
  MessageSquare,
  ListChecks,
  Timer,
  StickyNote,
  Users,
} from "lucide-react";

export type GroupFeatureId =
  | "overview"
  | "materials"
  | "lam"
  | "chat"
  | "quiz"
  | "notes"
  | "focus"
  | "participants";
export type FeatureAccess = "off" | "host" | "group";
export type NavigationMode = "follow" | "guided" | "open";
export type FeaturePolicy = Record<GroupFeatureId, FeatureAccess>;
export type GroupFeature = {
  id: GroupFeatureId;
  label: string;
  route: string;
  icon: LucideIcon;
  defaultAccess: FeatureAccess;
  supportsFollowHost: boolean;
  supportsSharedContext: boolean;
  supportsRoomData: boolean;
};

export const GROUP_FEATURES: readonly GroupFeature[] = [
  {
    id: "overview",
    label: "Overview",
    route: "overview",
    icon: BookOpen,
    defaultAccess: "group",
    supportsFollowHost: true,
    supportsSharedContext: true,
    supportsRoomData: true,
  },
  {
    id: "materials",
    label: "Materials",
    route: "materials",
    icon: FileText,
    defaultAccess: "group",
    supportsFollowHost: true,
    supportsSharedContext: true,
    supportsRoomData: true,
  },
  {
    id: "lam",
    label: "Group LAM",
    route: "lam",
    icon: Sparkles,
    defaultAccess: "group",
    supportsFollowHost: true,
    supportsSharedContext: true,
    supportsRoomData: true,
  },
  {
    id: "quiz",
    label: "Quiz",
    route: "quiz",
    icon: ListChecks,
    defaultAccess: "group",
    supportsFollowHost: true,
    supportsSharedContext: true,
    supportsRoomData: true,
  },
  {
    id: "notes",
    label: "Notes",
    route: "notes",
    icon: StickyNote,
    defaultAccess: "group",
    supportsFollowHost: true,
    supportsSharedContext: true,
    supportsRoomData: true,
  },
  {
    id: "focus",
    label: "Focus",
    route: "focus",
    icon: Timer,
    defaultAccess: "group",
    supportsFollowHost: true,
    supportsSharedContext: true,
    supportsRoomData: true,
  },
  {
    id: "chat",
    label: "Chat",
    route: "chat",
    icon: MessageSquare,
    defaultAccess: "group",
    supportsFollowHost: false,
    supportsSharedContext: true,
    supportsRoomData: true,
  },
  {
    id: "participants",
    label: "Participants",
    route: "participants",
    icon: Users,
    defaultAccess: "group",
    supportsFollowHost: false,
    supportsSharedContext: false,
    supportsRoomData: true,
  },
] as const;

export const DEFAULT_FEATURE_POLICY = Object.fromEntries(
  GROUP_FEATURES.map((feature) => [feature.id, feature.defaultAccess]),
) as FeaturePolicy;
export const GROUP_FEATURE_IDS = GROUP_FEATURES.map(
  (feature) => feature.id,
) as [GroupFeatureId, ...GroupFeatureId[]];
export function canAccessFeature(
  policy: FeaturePolicy | undefined,
  feature: GroupFeatureId,
  role: string,
) {
  const access = policy?.[feature] ?? DEFAULT_FEATURE_POLICY[feature];
  return access === "group" || (access === "host" && role === "host");
}
export function groupHref(roomId: string, feature: GroupFeatureId) {
  return `/group-study/${encodeURIComponent(roomId)}/${feature}`;
}
