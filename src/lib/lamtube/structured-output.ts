import { z } from "zod";

type Shape = { type?: string; properties?: Record<string, Shape>; items?: Shape; anyOf?: Shape[]; additionalProperties?: boolean };

/** Ignore unused model metadata; never coerce values or weaken canonical validation. */
function project(value: unknown, shape: Shape): unknown {
  if (shape.anyOf) {
    const branch = shape.anyOf.find(item => item.type === (value === null ? "null" : Array.isArray(value) ? "array" : typeof value));
    return branch ? project(value, branch) : value;
  }
  if (Array.isArray(value) && shape.items) return value.map(item => project(item, shape.items!));
  if (value && typeof value === "object" && !Array.isArray(value) && shape.properties && shape.additionalProperties === false) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => Object.hasOwn(shape.properties!, key)).map(([key, item]) => [key, project(item, shape.properties![key])]));
  }
  return value;
}

export function parseGenerated<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(project(value, z.toJSONSchema(schema) as Shape));
}

/** One corrective attempt within the caller's deadline, not an unbounded retry loop. */
export async function validatedGeneration<T>(schema: z.ZodType<T>, prompt: string, generate: (prompt: string) => Promise<unknown>): Promise<T> {
  try {
    return parseGenerated(schema, await generate(prompt));
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    const issues = error.issues.slice(0, 12).map(issue => ({ path: issue.path.join("."), message: issue.message }));
    console.warn("[LAMTube] repairing structured output", { issues });
    return parseGenerated(schema, await generate(`${prompt}\nThe previous response failed validation. Generate a corrected complete JSON object, not a schema or a wrapper. Fix these validation errors: ${JSON.stringify(issues)}`));
  }
}
