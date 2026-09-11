import { expect, test } from "bun:test";
import config from "../next.config";

test("serverless OCR retains the Node worker and its dynamic runtime dependencies", () => {
  expect(config.serverExternalPackages).toContain("tesseract.js");
  const included = config.outputFileTracingIncludes?.["/api/ocr"];
  expect(included).toContain("./node_modules/tesseract.js/src/**/*");
  expect(included).toContain("./node_modules/tesseract.js-core/**/*");
  expect(included).toContain("./node_modules/wasm-feature-detect/**/*");
  expect(included).toContain("./node_modules/regenerator-runtime/**/*");
});
