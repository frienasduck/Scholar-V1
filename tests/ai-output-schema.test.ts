import { expect, test } from "bun:test";
import { z } from "zod";
import { scenePlanSchema } from "../src/lib/lamtube/model";
import { strictOutputSchema, structuredResponseFormat } from "../src/lib/ai/output-schema";

test("strict generation requires every nested field without mutating the canonical schema", () => {
  const schema = z.toJSONSchema(scenePlanSchema);
  const original = JSON.stringify(schema);
  const strict = strictOutputSchema(schema);
  function inspect(node: Record<string, unknown>) {
    expect(node.default).toBeUndefined();
    if (node.properties) {
      expect(node.required).toEqual(Object.keys(node.properties));
      expect(node.additionalProperties).toBe(false);
      Object.values(node.properties).forEach(value => inspect(value as Record<string, unknown>));
    }
    if (node.items) inspect(node.items as Record<string, unknown>);
    if (Array.isArray(node.anyOf)) node.anyOf.forEach(inspect);
  }
  inspect(strict);
  expect(JSON.stringify(schema)).toBe(original);
});
test("strict output is opt-in and only sent to supported models", () => {
  expect(structuredResponseFormat("openai/gpt-oss-20b", { type: "object", properties: {} }).type).toBe("json_schema");
  expect(structuredResponseFormat("custom-model", {}).type).toBe("json_object");
  expect(structuredResponseFormat("openai/gpt-oss-20b").type).toBe("json_object");
});
