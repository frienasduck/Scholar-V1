import { assertRoomMutationRequest } from "@/lib/group-study/server";
import { runRoomStudyTool, studyPromptSchema, studyToolErrorResponse } from "@/lib/group-study/tools";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    assertRoomMutationRequest(request);
    const input = studyPromptSchema.safeParse(await request.json());
    if (!input.success) return Response.json({ code: "VALIDATION_ERROR", message: "Enter a study question up to 2,000 characters and valid material context." }, { status: 400 });
    const { roomId } = await params;
    const result = await runRoomStudyTool(roomId, `${input.data.mode}: ${input.data.prompt}`, input.data.mode === "quiz-us" ? "quiz" : "text", request.signal, input.data.resourceId, input.data.page);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return studyToolErrorResponse(error); }
}
