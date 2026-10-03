import { readBoundedJson } from "@/lib/security/request-body";
import { after } from "next/server";
import { queueVideo, runVideoBatch } from "@/lib/lamtube/jobs";
import { authorize, fail, reply } from "@/lib/lamtube/http";
import { readVideo, publicVideo, deleteVideo } from "@/lib/lamtube/store";
import { act, actionSchema, isInsightResult } from "@/lib/lamtube/actions";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const user = await authorize(request);
    return reply({
      video: publicVideo(await readVideo(user.id, (await context.params).id)),
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const action = actionSchema.parse(await readBoundedJson(request, 35000));
    const user = await authorize(
      request,
      true,
      action.action === "ask",
      ["start", "step", "retry"].includes(action.action)
    );
    const id = (await context.params).id;
    if (action.action === "start" || action.action === "retry") {
      const video = await queueVideo(user.id, id, action.action === "retry");
      if (video.status === "generating") after(() => runVideoBatch(user.id, id));
      return reply({ video: publicVideo(video) }, 202);
    }
    const result = await act(user.id, id, action);
    return reply(
      isInsightResult(result)
        ? { ...result, video: publicVideo(result.video) }
        : { video: publicVideo(result) }
    );
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const user = await authorize(request, true);
    await deleteVideo(user.id, (await context.params).id);
    return reply({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
