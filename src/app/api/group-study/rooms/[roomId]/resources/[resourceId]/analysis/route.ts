import { assertRoomMutationRequest } from "@/lib/group-study/server";
import {
  materialAnalysisSchema,
  runRoomStudyTool,
  studyToolErrorResponse,
} from "@/lib/group-study/tools";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string; resourceId: string }> },
) {
  try {
    assertRoomMutationRequest(request);
    const input = materialAnalysisSchema.safeParse(await request.json());
    if (!input.success)
      return Response.json(
        {
          code: "VALIDATION_ERROR",
          message: "Choose a valid study analysis tool.",
        },
        { status: 400 },
      );
    const { roomId, resourceId } = await params;
    const prompt =
      input.data.prompt ||
      {
        summary:
          "Summarize this material with key concepts, definitions, formulas, important points, and page references.",
        quiz: "Create five questions grounded in this material.",
        flashcards: "Create revision flashcards from this material.",
        explain: "Explain the current material and the host's active page.",
      }[input.data.operation];
    return Response.json(
      await runRoomStudyTool(
        roomId,
        prompt,
        input.data.operation === "explain" ? "text" : input.data.operation,
        request.signal,
        resourceId,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return studyToolErrorResponse(error);
  }
}
