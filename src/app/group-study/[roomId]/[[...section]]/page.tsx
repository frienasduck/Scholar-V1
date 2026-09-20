import { notFound } from "next/navigation";
import { GroupStudyLanding } from "@/components/group-study/landing";
import {
  GROUP_FEATURES,
  type GroupFeatureId,
} from "@/lib/group-study/features";

export default async function GroupSessionPage({
  params,
}: {
  params: Promise<{ roomId: string; section?: string[] }>;
}) {
  const { roomId, section } = await params;
  const feature = (section?.[0] ?? "overview") as GroupFeatureId;
  if (
    !GROUP_FEATURES.some((item) => item.id === feature) ||
    (section && section.length > 1)
  )
    notFound();
  return <GroupStudyLanding initialRoomId={roomId} initialFeature={feature} />;
}
