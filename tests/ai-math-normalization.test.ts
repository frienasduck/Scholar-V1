import { expect, test } from "bun:test";
import { prepareAIContentForRendering } from "../src/lib/ai/content";

test("explicit display math is not wrapped again by legacy normalization", () => {
  const expression = String.raw`\mathbf{F}_{\text{net}} = 2\ \mathrm{kg}\;\times\;3\ \mathrm{m\,s^{-2}} = 6\ \mathrm{N}`;
  expect(prepareAIContentForRendering(`\\[\n${expression}\n\\]`).trim()).toBe(`$$\n${expression}\n$$`);
  expect(prepareAIContentForRendering(`$$\n${expression}\n$$`)).toBe(`$$\n${expression}\n$$`);
});

test("legacy equations still normalize outside explicit math and code", () => {
  const explicit = String.raw`$a = x^2 / y^2$`;
  const code = '`E_n = 10^(-18) / n^2`';
  const prepared = prepareAIContentForRendering(`${explicit}\nE_n = 10^(-18) / n^2\n${code}`);
  expect(prepared).toContain(explicit);
  expect(prepared).toContain('$$\nE_{n} = 10^{-18} / n^{2}\n$$');
  expect(prepared).toContain(code);
});
