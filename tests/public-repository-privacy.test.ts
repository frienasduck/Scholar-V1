import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test("website source and public files do not disclose the owner or repository address", () => {
  for (const path of [...files("src"), ...files("public")].filter(path => /\.(tsx?|jsx?|css|json|txt|html|svg|xml)$/i.test(path))) {
    const source = readFileSync(path, "utf8");
    expect(source, path).not.toMatch(/frienasduck|github\.com\/[^\s"'<>]*scholar-v1|scholar-v1\.vercel\.app/i);
  }
}, 60_000);

test("public support pages offer Scholar support without source-host links", () => {
  for (const path of ["src/app/help/page.tsx", "src/app/updates/page.tsx", "src/components/views/settings.tsx"]) {
    expect(readFileSync(path, "utf8"), path).not.toMatch(/github|project repository|repository worklog/i);
  }
  expect(readFileSync("src/app/help/page.tsx", "utf8")).toContain("Feedback button");
  expect(readFileSync("public/robots.txt", "utf8")).toContain("https://scholarofficial.vercel.app/sitemap.xml");
});
