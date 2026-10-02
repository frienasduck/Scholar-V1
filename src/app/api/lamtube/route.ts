import { z } from "zod";
import { readBoundedJson } from "@/lib/security/request-body";
import { resolveUserEntitlements } from "@/lib/subscriptions/entitlements";
import { getAIVideoUsage } from "@/lib/subscriptions/monthly-usage";
import { authorize, fail, reply } from "@/lib/lamtube/http";
import { listVideos, insertVideo, publicVideo } from "@/lib/lamtube/store";
import { settingsSchema } from "@/lib/lamtube/model";
import { validateSettings } from "@/lib/lamtube/settings";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await authorize(request);
    const [videos, usage] = await Promise.all([
      listVideos(user.id),
      getAIVideoUsage(user.id, await resolveUserEntitlements(user.id)),
    ]);
    return reply({ videos, usage });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await authorize(request, true);
    const body = z
      .object({ settings: settingsSchema, requestKey: z.string().uuid() })
      .strict()
      .parse(await readBoundedJson(request, 15000));
    body.settings = await validateSettings(user.id, body.settings);
    return reply(
      {
        video: publicVideo(
          await insertVideo(user.id, body.settings, body.requestKey)
        ),
      },
      201
    );
  } catch (error) {
    return fail(error);
  }
}
