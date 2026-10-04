import { expect, test } from "bun:test";
import config from "../next.config";

test("serverless OCR retains the Node worker and its dynamic runtime dependencies", () => {
  expect(config.serverExternalPackages).toContain("tesseract.js");
  const included = config.outputFileTracingIncludes?.["/api/ocr"];
  expect(included).toContain("./node_modules/tesseract.js/src/**/*");
  expect(included).toContain("./node_modules/tesseract.js-core/*lstm*");
  expect(included).toContain("./node_modules/tesseract.js-core/package.json");
  expect(included).toContain("./node_modules/wasm-feature-detect/**/*");
  expect(included).toContain("./node_modules/regenerator-runtime/**/*");
  expect(included).toContain("./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*");
  const privateOcr = config.outputFileTracingIncludes?.["/api/ebooks/*/ocr"];
  expect(privateOcr).toContain("./node_modules/pdfjs-dist/standard_fonts/**/*");
  expect(privateOcr).toContain("./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*");
  expect(config.outputFileTracingExcludes?.["/api/ocr"]).toContain("./node_modules/.prisma/client/*.tmp*");
  expect(config.outputFileTracingExcludes?.["/api/ocr"]).toContain("./public/ebook-pages-*-clean/**/*");
  expect(config.outputFileTracingExcludes?.["/api/ebooks/*/ocr"]).toContain("./node_modules/@tesseract.js-data/eng/4.0.0/**/*");
  expect(config.outputFileTracingExcludes?.["/api/ocr"]).toContain("./node_modules/@prisma/client/runtime/query_compiler_bg.*");
  expect(config.outputFileTracingExcludes?.["/api/ocr"]).toContain("./node_modules/tesseract.js-core/tesseract-core.wasm*");
  expect(config.outputFileTracingExcludes?.["/api/ocr"]).not.toContain("./node_modules/tesseract.js-core/*lstm*");
});
