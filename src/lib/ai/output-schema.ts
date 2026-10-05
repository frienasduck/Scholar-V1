/** Provider-facing strict shape. Canonical Zod validation still runs after generation. */
export function strictOutputSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema };
  delete result.$schema;
  delete result.default;
  if (result.properties && typeof result.properties === "object") {
    const properties = result.properties as Record<string, Record<string, unknown>>;
    result.properties = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, strictOutputSchema(value)]));
    result.required = Object.keys(properties);
    result.additionalProperties = false;
  }
  if (result.items && typeof result.items === "object") result.items = strictOutputSchema(result.items as Record<string, unknown>);
  if (Array.isArray(result.anyOf)) result.anyOf = result.anyOf.map(item => strictOutputSchema(item));
  return result;
}

export function structuredResponseFormat(model: string, schema?: Record<string, unknown>) {
  return schema && ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"].includes(model)
    ? { type: "json_schema" as const, json_schema: { name: "scholar_output", strict: true, schema: strictOutputSchema(schema) } }
    : { type: "json_object" as const };
}
