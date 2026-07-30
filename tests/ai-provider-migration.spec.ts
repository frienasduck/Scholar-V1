import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  AI_PROVIDER_INVENTORY,
  SCHOLAR_AI_PROVIDER_POLICY,
  getDevelopmentProviderDiagnostics,
} from "../src/lib/ai/provider-policy";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("all eligible Scholar text generation uses the dedicated Groq route", () => {
  const route = read("src/app/api/ai/route.ts");
  expect(route).toContain("@/lib/ai/scholar-groq");
  expect(route).toContain("generateScholarGroqText");
  expect(route).toContain("generateScholarGroqJSON");
  expect(route).toContain("streamScholarGroqText");
  expect(route).not.toMatch(/Nvidia|NVIDIA|nvidia/);

  const sourceFiles = execFileSync(
    "git",
    ["ls-files", "src/**/*.ts", "src/**/*.tsx"],
    { cwd: root, encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const eligibleNvidiaTextReferences = sourceFiles
    .filter(
      (file) =>
        !file.startsWith("src/app/api/lam/") &&
        file !== "src/app/api/ai-image/route.ts" &&
        file !== "src/lib/ai/nvidia-image.ts" &&
        file !== "src/lib/ai/gemini-image.ts",
    )
    .flatMap((file) => {
      if (!fs.existsSync(path.join(root, file))) return [];
      const source = read(file);
      return /NVIDIA_TEXT_|integrate\.api\.nvidia\.com|generateNvidiaText|generateNvidiaJSON|streamNvidiaText/.test(
        source,
      )
        ? [file]
        : [];
    });
  expect(eligibleNvidiaTextReferences).toEqual([]);
});

test("structured output, formatting, cancellation, and streaming remain enabled", () => {
  const route = read("src/app/api/ai/route.ts");
  const client = read("src/lib/ai/scholar-groq.ts");
  const personas = read("src/lib/ai/personas.ts");
  expect(route).toContain("schemaForMode");
  expect(route).toContain("schema.safeParse");
  expect(route).toContain("request.signal");
  expect(client).toContain('response_format: { type: "json_object" }');
  expect(client).toContain("GROQ_INVALID_JSON");
  expect(client).toContain("stream: true");
  expect(client).toContain("for await (const chunk of stream)");
  expect(personas).toContain("SCHOLAR_AI_FORMATTING_RULES");
});

test("Groq configuration is server-only and requires both configured variables", () => {
  const client = read("src/lib/ai/scholar-groq.ts");
  expect(client).toContain('import "server-only"');
  expect(client).toContain("process.env.GROQ_API_KEY");
  expect(client).toContain("process.env.GROQ_MODEL");
  expect(client).toContain("GROQ_NOT_CONFIGURED");
  expect(client).toContain("GROQ_MODEL_NOT_CONFIGURED");

  const clientVisibleSources = execFileSync(
    "git",
    ["ls-files", "src/components/**/*.tsx", "src/lib/ai.ts", "src/lib/ai/client.ts"],
    { cwd: root, encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .map(read)
    .join("\n");
  expect(clientVisibleSources).not.toContain("GROQ_API_KEY");
  expect(clientVisibleSources).not.toContain("NEXT_PUBLIC_GROQ");
});

test("LAM remains on its existing isolated implementation", () => {
  const lamRoute = read("src/app/api/lam/chat/route.ts");
  expect(lamRoute).toContain('from "@/lib/ai/groq"');
  expect(lamRoute).toContain("streamGroqText");
  expect(lamRoute).not.toContain("scholar-groq");

  const changedLAMFiles = execFileSync("git", ["diff", "--name-only"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter((file) =>
      /(?:^|\/)(?:lam(?:-widget)?|lam\/|api\/lam\/)/i.test(file),
    );
  expect(changedLAMFiles).toEqual([]);
});

test("AISIG enhancement uses Groq while image generation stays unchanged", () => {
  const aiTools = read("src/components/views/ai-tools.tsx");
  const aisig = aiTools.slice(
    aiTools.indexOf("function AISIG()"),
    aiTools.indexOf("const generateImage", aiTools.indexOf("function AISIG()")),
  );
  expect(aisig).toContain('await askAI(prompt, "default")');
  expect(read("src/lib/ai.ts")).toContain('from "@/lib/ai/client"');
  expect(read("src/lib/ai/client.ts")).toContain('fetch("/api/ai"');

  const imageRoute = read("src/app/api/ai-image/route.ts");
  expect(imageRoute).toContain('from "@/lib/ai/nvidia-image"');
  expect(imageRoute).toContain("generateNvidiaImage");
  expect(imageRoute).not.toMatch(/scholar-groq|generateScholarGroq/i);

  const changedImageFiles = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "--",
      "src/app/api/ai-image/route.ts",
      "src/lib/ai/nvidia-image.ts",
      "src/lib/ai/gemini-image.ts",
    ],
    { cwd: root, encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean);
  expect(changedImageFiles).toEqual([]);
});

test("provider policy and inventory encode the migration explicitly", () => {
  expect(SCHOLAR_AI_PROVIDER_POLICY).toEqual({
    lam: "unchanged",
    aisigImageGeneration: "unchanged",
    aisigPromptEnhancement: "groq",
    allOtherTextGeneration: "groq",
  });
  expect(
    AI_PROVIDER_INVENTORY.filter(
      (item) => item.targetProvider === "groq",
    ).every((item) => item.routeOrModule === "src/app/api/ai/route.ts"),
  ).toBeTruthy();
  expect(
    AI_PROVIDER_INVENTORY.find((item) => item.feature === "LAM")
      ?.exclusionReason,
  ).toBe("LAM");
  expect(
    AI_PROVIDER_INVENTORY.find(
      (item) => item.feature === "AISIG image generation",
    )?.exclusionReason,
  ).toBe("AISIG_IMAGE_GENERATION");
  expect(getDevelopmentProviderDiagnostics("development")).not.toBeNull();
  expect(getDevelopmentProviderDiagnostics("production")).toBeNull();
});
