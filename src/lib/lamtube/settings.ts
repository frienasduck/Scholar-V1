import "server-only";
import { getCurriculum } from "@/lib/curriculum-helper";
import { checkGrade, ProfileError } from "@/lib/personalization/server";
import type { VideoSettings } from "./model";

/** Apply the same curriculum and access policy to creation and draft edits. */
export async function validateSettings(
  userId: string,
  settings: VideoSettings
) {
  await checkGrade(userId, settings.grade);
  const subject = getCurriculum(settings.grade).find(
    (s) => s.id === settings.subjectId
  );
  if (
    !subject ||
    new Set(settings.chapters.map((c) => c.id)).size !==
      settings.chapters.length ||
    settings.chapters.some((c) => !subject.chapters.some((s) => s.id === c.id))
  ) {
    throw new ProfileError(
      "Choose distinct chapters belonging to the selected class and subject.",
      422
    );
  }
  return {
    ...settings,
    chapters: settings.chapters.map((c) => ({
      id: c.id,
      title: subject.chapters.find((s) => s.id === c.id)!.title,
    })),
  };
}
