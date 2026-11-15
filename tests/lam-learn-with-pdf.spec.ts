import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://127.0.0.1:3100";
const BRIDGE_URL = "http://127.0.0.1:3101";
const ARTIFACT_DIR =
  "C:/Users/Lenovo/.gemini/antigravity/brain/8c5e0cba-dead-405e-8c95-37b327b3104e/learn-with-pdf";
const FIXTURE_DIR = join(process.cwd(), "test-results", "learn-with-pdf-fixtures");

const ALL_ENTITLEMENTS = [
  "levels", "aisig", "homework_scanner", "exam_prep", "assignments",
  "practical_lab", "derivation_library", "store_plus_items",
  "expanded_file_storage", "appearance_lab", "class_9_access",
  "nigtube_ad_free", "study_music_ad_free", "quiz_generation_plus",
  "slideshow_generation_plus", "formula_explorer", "plus_coin_bonus",
  "python_workspace", "scholar_intelligence", "lam_ai", "premium_experiments",
  "premium_resources", "jee_focused_mode", "group_study_beta",
  "workspace_ai", "custom_ebook_upload",
];

test.use({
  baseURL: BASE_URL,
  launchOptions: { executablePath },
  viewport: { width: 1440, height: 900 },
});
test.setTimeout(240_000);

type PdfSpecPage =
  | { kind: "text"; lines: string[] }
  | { kind: "jpeg"; jpeg: Buffer; width: number; height: number; captionLines?: string[] };

function buildCustomPdf(
  pages: PdfSpecPage[],
  options?: { title?: string; paddingBytes?: number; encrypted?: boolean }
): Buffer {
  const objects: Array<string | Buffer> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pageRefs: number[] = [];

  for (const p of pages) {
    if (p.kind === "text") {
      const textOps = p.lines
        .map((line, idx) => {
          const safe = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
          return `BT /F1 12 Tf 40 ${740 - idx * 20} Td (${safe}) Tj ET`;
        })
        .join("\n");
      const contentId = objects.length + 1;
      objects.push(`<< /Length ${Buffer.byteLength(textOps)} >>\nstream\n${textOps}\nendstream`);
      const pageId = objects.length + 1;
      pageRefs.push(pageId);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
      );
    } else {
      const imgId = objects.length + 1;
      const imgHeader = Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
        "latin1"
      );
      const imgFooter = Buffer.from("\nendstream", "latin1");
      objects.push(Buffer.concat([imgHeader, p.jpeg, imgFooter]));

      const captionOps = (p.captionLines ?? [])
        .map((line, idx) => {
          const safe = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
          return `BT /F1 12 Tf 40 ${200 - idx * 18} Td (${safe}) Tj ET`;
        })
        .join("\n");

      const contentStr = `q 520 0 0 260 40 460 cm /Im1 Do Q\n${captionOps}`;
      const contentId = objects.length + 1;
      objects.push(`<< /Length ${Buffer.byteLength(contentStr)} >>\nstream\n${contentStr}\nendstream`);
      const pageId = objects.length + 1;
      pageRefs.push(pageId);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`
      );
    }
  }

  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.map((r) => `${r} 0 R`).join(" ")}] >>`;
  const infoId = objects.length + 1;
  objects.push(`<< /Title (${(options?.title || "Fixture PDF").replace(/[()\\]/g, "")}) >>`);

  if (options?.paddingBytes && options.paddingBytes > 0) {
    const padBuf = Buffer.alloc(options.paddingBytes, 0x20);
    objects.push(
      Buffer.concat([
        Buffer.from(`<< /Length ${padBuf.length} >>\nstream\n`, "latin1"),
        padBuf,
        Buffer.from("\nendstream", "latin1"),
      ])
    );
  }

  let encryptRef = "";
  if (options?.encrypted) {
    const md5 = (v: Uint8Array) => createHash("md5").update(v).digest();
    const rc4 = (key: Uint8Array, data: Uint8Array) => {
      const s = Array.from({ length: 256 }, (_, i) => i);
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key[i % key.length]) % 256;
        [s[i], s[j]] = [s[j], s[i]];
      }
      let i = 0;
      j = 0;
      return Buffer.from(
        data.map((b) => {
          i = (i + 1) % 256;
          j = (j + s[i]) % 256;
          [s[i], s[j]] = [s[j], s[i]];
          return b ^ s[(s[i] + s[j]) % 256];
        })
      );
    };
    const pad = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");
    const owner = rc4(md5(pad).subarray(0, 5), pad);
    const permission = Buffer.alloc(4);
    permission.writeInt32LE(-4);
    const fileKey = md5(Buffer.concat([pad, owner, permission, Buffer.alloc(16)])).subarray(0, 5);
    const user = rc4(fileKey, pad);
    objects.push(
      `<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P -4 >>`
    );
    encryptRef = `/Encrypt ${objects.length} 0 R /ID [<${"0".repeat(32)}> <${"0".repeat(32)}>]`;
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [0];
  let totalLen = chunks[0].length;
  objects.forEach((obj, idx) => {
    offsets.push(totalLen);
    const head = Buffer.from(`${idx + 1} 0 obj\n`, "latin1");
    const body = typeof obj === "string" ? Buffer.from(obj, "latin1") : obj;
    const tail = Buffer.from("\nendobj\n", "latin1");
    chunks.push(head, body, tail);
    totalLen += head.length + body.length + tail.length;
  });

  const xrefOffset = totalLen;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R ${encryptRef} >>`,
    "startxref",
    `${xrefOffset}`,
    "%%EOF\n",
  ].join("\n");
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

async function renderScanJpeg(lines: string[]): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const width = 1200;
  const height = 600;
  const tspans = lines
    .map(
      (line, i) =>
        `<text x="60" y="${120 + i * 75}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="bold" fill="#111111">${line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</text>`
    )
    .join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/>${tspans}</svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
  return { jpeg, width, height };
}

async function forwardToBridge(route: import("@playwright/test").Route, userId = "e2e-user-1") {
  const req = route.request();
  const url = new URL(req.url());
  const headers = new Headers(req.headers());
  headers.delete("host");
  headers.delete("content-length");
  headers.set("X-Test-User-Id", userId);

  const method = req.method().toUpperCase();
  const bodyBuf = method !== "GET" && method !== "HEAD" ? req.postDataBuffer() : null;
  const upstream = await fetch(`${BRIDGE_URL}${url.pathname}${url.search}`, {
    method,
    headers,
    body: bodyBuf ? Uint8Array.from(bodyBuf) : undefined,
  });

  const outHeaders: Record<string, string> = {};
  upstream.headers.forEach((value, key) => {
    const low = key.toLowerCase();
    if (low === "transfer-encoding" || low === "content-encoding" || low === "connection") return;
    outHeaders[key] = value;
  });
  const respBody = Buffer.from(await upstream.arrayBuffer());
  await route.fulfill({
    status: upstream.status,
    headers: outHeaders,
    body: respBody,
  });
}

async function seedAuthedLocalState(page: Page, email: string, name: string) {
  await page.route(/\.mp4(?:\?.*)?$/, (route) => route.abort());
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        developerMode: false,
        user: {
          id: "e2e-user-1",
          email,
          name,
          role: "USER",
          coins: 500,
          currentScholarClass: 11,
        },
        plan: "PLUS",
        entitlements: ALL_ENTITLEMENTS,
        entitlementsLoaded: true,
        limits: { storageBytes: 512 * 1024 * 1024, dailyQuiz: 100, dailySlideshow: 50 },
        access: {
          authenticated: true,
          userId: "e2e-user-1",
          role: "USER",
          plan: "PLUS",
          source: "plus",
          entitlementsLoaded: true,
          entitlements: ALL_ENTITLEMENTS,
        },
        config: { enabled: true },
        beta: { enabled: false },
      }),
    });
  });
  await page.route("**/api/lam/live/providers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ providers: ["auto", "gemini", "groq"], active: "auto" }) })
  );
  await page.route("**/api/lam/live/memory**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ memories: [] }) })
  );
  await page.route("**/api/lam/live/sessions**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sessions: [] }) })
  );
  await page.route("**/api/lam/identity", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: true }) })
  );
  await page.route("**/api/lam/pdf**", (route) => forwardToBridge(route, "e2e-user-1"));
  await page.route("**/api/lam/plugins/execute", (route) => forwardToBridge(route, "e2e-user-1"));

  await page.addInitScript(
    ({ email, name }) => {
      localStorage.setItem("scholar-workspace-owner-v1", email);
      localStorage.setItem(
        "neha-scholar-v5",
        JSON.stringify({
          schema: 7,
          state: {
            authed: true,
            guestMode: false,
            onboarded: true,
            user: {
              email,
              name,
              username: "pdf_tester",
              bio: "",
              school: "",
              class: "11 - CBSE",
              avatar: "P",
              scholarClass: 11,
              jeeMode: false,
            },
            settings: { mobileLamMode: "off", elamEnabled: false },
          },
        })
      );
    },
    { email, name }
  );
}

async function uploadPdfViaApi(
  request: APIRequestContext,
  fileName: string,
  bytes: Buffer,
  userId = "e2e-user-1"
) {
  const key = `e2e-${createHash("sha256").update(fileName).digest("hex").slice(0, 16)}-${Date.now()}`;
  const startRes = await request.post(`${BRIDGE_URL}/api/lam/pdf/uploads`, {
    headers: { Origin: BASE_URL, "X-Test-User-Id": userId },
    data: { key, name: fileName, title: fileName.replace(/\.pdf$/i, ""), size: bytes.length },
  });
  expect(startRes.status()).toBe(200);
  const startJson = (await startRes.json()) as {
    uploadId: string;
    offset: number;
    chunkBytes: number;
  };

  let offset = startJson.offset;
  const chunkBytes = startJson.chunkBytes;
  while (offset < bytes.length) {
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + chunkBytes));
    const putRes = await request.put(
      `${BRIDGE_URL}/api/lam/pdf/uploads?id=${encodeURIComponent(startJson.uploadId)}&offset=${offset}`,
      {
        headers: { Origin: BASE_URL, "Content-Type": "application/octet-stream", "X-Test-User-Id": userId },
        data: slice,
      }
    );
    expect(putRes.status()).toBe(200);
    const putJson = (await putRes.json()) as { offset: number };
    offset = putJson.offset;
  }

  const finishRes = await request.post(`${BRIDGE_URL}/api/lam/pdf/uploads`, {
    headers: { Origin: BASE_URL, "X-Test-User-Id": userId },
    data: { finish: startJson.uploadId },
  });
  expect(finishRes.status()).toBe(200);
  const finishJson = (await finishRes.json()) as { doc: { docId: string; stage: string } };
  const docId = finishJson.doc.docId;

  let finalJson: Record<string, unknown> = {};
  let transientRetries = 0;
  for (let i = 0; i < 30; i++) {
    const procRes = await request.post(`${BRIDGE_URL}/api/lam/pdf/${encodeURIComponent(docId)}/process`, {
      headers: { Origin: BASE_URL, "X-Test-User-Id": userId },
      data: {},
    });
    const procJson = (await procRes.json()) as Record<string, unknown>;
    if (!procRes.ok()) {
      if ((procRes.status() === 502 || procRes.status() === 503 || procRes.status() === 429) && transientRetries < 2) {
        transientRetries += 1;
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      return { docId, ok: false, status: procRes.status(), body: procJson };
    }
    finalJson = procJson;
    if (procJson.stage === "ready") {
      return { docId, ok: true, status: 200, body: finalJson };
    }
  }
  throw new Error(`Processing did not finish in 30 steps for ${fileName}`);
}

test("Learn with PDF: full E2E UI, OCR, Tests A-E, citations, PDF viewer, auth isolation & responsive audit", async ({
  browser,
}) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  mkdirSync(FIXTURE_DIR, { recursive: true });

  const ts = Date.now();
  const user1Email = `pdf-e2e-1-${ts}@scholar.test`;

  // Generate real Test A-E fixtures
  const testAPath = join(FIXTURE_DIR, "test-a-gravitation.pdf");
  const testBPath = join(FIXTURE_DIR, "test-b-scanned-ohm.pdf");
  const testCPath = join(FIXTURE_DIR, "test-c-mixed-optics.pdf");
  const testDPath = join(FIXTURE_DIR, "test-d-large-valid.pdf");
  const testECorruptPath = join(FIXTURE_DIR, "test-e-corrupt.pdf");
  const testEOversizedPath = join(FIXTURE_DIR, "test-e-oversized.pdf");

  const testABytes = buildCustomPdf(
    [
      {
        kind: "text",
        lines: [
          "CHAPTER 1 UNIVERSAL GRAVITATION",
          "Definition: Every particle attracts every other particle with force F = G M m / r^2.",
          "Prerequisite: Students should first know Newton's second law F = m a.",
        ],
      },
      {
        kind: "text",
        lines: [
          "1.2 Kepler Third Law of Periods",
          "The square of the orbital period T is proportional to the cube of semi-major axis a: T^2 = k a^3.",
          "Example 1: If orbital radius increases fourfold, the orbital period increases by factor 8.",
        ],
      },
      {
        kind: "text",
        lines: [
          "1.3 Escape Velocity and Orbital Energy",
          "Formula: Escape velocity from Earth surface is v_e = sqrt(2 G M / R) = 11.2 km/s.",
          "Exercise 1: Compute the escape velocity for a planet with twice Earth mass and same radius.",
        ],
      },
    ],
    { title: "Gravitation Complete Chapter" }
  );
  writeFileSync(testAPath, testABytes);

  const ohmScan = await renderScanJpeg([
    "OHM LAW EXPERIMENT",
    "Voltage V = I * R across resistor",
    "Measured Resistance R = 5 Ohms",
  ]);
  const testBBytes = buildCustomPdf(
    [{ kind: "jpeg", jpeg: ohmScan.jpeg, width: ohmScan.width, height: ohmScan.height }],
    { title: "Scanned Ohm Law Notes" }
  );
  writeFileSync(testBPath, testBBytes);

  const snellScan = await renderScanJpeg([
    "REFRACTION EXPERIMENT",
    "Snell Law: n1 sin(i) = n2 sin(r)",
  ]);
  const testCBytes = buildCustomPdf(
    [
      {
        kind: "text",
        lines: [
          "CHAPTER 3 GEOMETRIC OPTICS",
          "Definition: Reflection angle equals incidence angle theta_r = theta_i.",
        ],
      },
      { kind: "jpeg", jpeg: snellScan.jpeg, width: snellScan.width, height: snellScan.height },
      {
        kind: "text",
        lines: [
          "Fig 3.1 Convex lens focal point convergence diagram.",
          "Lens formula relates focal length f, object distance u, and image distance v: 1/f = 1/v - 1/u.",
        ],
      },
    ],
    { title: "Mixed Geometric Optics" }
  );

  // Valid ~23.8 MB PDF (< 25 MB exact cap)
  const testDBytes = buildCustomPdf(
    [
      { kind: "text", lines: ["CHAPTER 4 THERMODYNAMICS LARGE TEXTBOOK", "First law: dQ = dU + dW."] },
      { kind: "text", lines: ["Section 4.2 Isothermal process work: W = n R T ln(V2 / V1)."] },
    ],
    { title: "Large Valid Thermodynamics PDF", paddingBytes: 23_800_000 }
  );
  writeFileSync(testDPath, testDBytes);
  writeFileSync(testCPath, testCBytes);

  writeFileSync(testECorruptPath, Buffer.from("THIS IS PLAIN TEXT SPOOFING AS PDF"));
  writeFileSync(testEOversizedPath, Buffer.alloc(26 * 1024 * 1024, 0x25));

  const encryptedBytes = buildCustomPdf(
    [{ kind: "text", lines: ["Secret locked chapter"] }],
    { title: "Locked PDF", encrypted: true }
  );

  const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context1.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  try {
    // 1. Reset real-code PDF bridge and verify health + anonymous 401 gate
    const resetRes = await context1.request.post(`${BRIDGE_URL}/reset`);
    expect(resetRes.status()).toBe(200);
    const unauthRes = await context1.request.get(`${BRIDGE_URL}/api/lam/pdf`, {
      headers: { "X-Test-User-Id": "anonymous" },
    });
    expect(unauthRes.status()).toBe(401);

    await seedAuthedLocalState(page, user1Email, "PDF Learner One");

    // 2. Open LAM AI Chat and test @Learn with PDF autocomplete discovery + Plugins directory
    await page.goto("/lam-ai", { waitUntil: "domcontentloaded" });
    const openNowBtn = page.getByRole("button", { name: "Open now" });
    if (await openNowBtn.isVisible({ timeout: 3_500 }).catch(() => false)) {
      await openNowBtn.click();
    }
    await page.getByText("Opening Scholar...").waitFor({ state: "hidden", timeout: 8_000 }).catch(() => undefined);
    const notNowBtn = page.getByRole("button", { name: /Not now/i });
    if (await notNowBtn.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await notNowBtn.click();
    }
    const composer = page.getByLabel("Message LAM AI");
    await expect(composer).toBeVisible({ timeout: 25_000 });

    await composer.fill("@Learn");
    const mentionOpt = page.getByRole("option", { name: /Learn with PDF/i }).first();
    await expect(mentionOpt).toBeVisible();
    await page.screenshot({ path: join(ARTIFACT_DIR, "01-desktop-1440-chat-mention.png") });
    await mentionOpt.click();

    await composer.press("Enter");
    const dropzoneText = page.getByText("Drop your PDF here, or click to select from device").first();
    await expect(dropzoneText).toBeVisible({ timeout: 20_000 });

    // 3. Test E (UI error checks on spoofed & >25 MB PDFs)
    const fileInput = page.getByTestId("learn-with-pdf-file-input").first();
    await fileInput.setInputFiles(testECorruptPath);
    await expect(page.getByText(/valid %PDF- signature|not a valid PDF|invalid %PDF-/i).first()).toBeVisible({ timeout: 10_000 });

    await fileInput.setInputFiles(testEOversizedPath);
    await expect(page.getByText(/exceeds.*25 MB|25 MB limit/i).first()).toBeVisible({ timeout: 10_000 });

    // 4. Test A (Text-based 3-page PDF through full real UI pipeline)
    await fileInput.setInputFiles(testAPath);
    await expect(
      page.getByText(/Source Page Citations|Document Structure & Intelligence/i).first()
    ).toBeVisible({ timeout: 90_000 });
    await page.getByText(/Source Page Citations/i).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(ARTIFACT_DIR, "02-desktop-1440-analysis-tutor.png") });

    // Ask grounded PDF question directly in chat
    await composer.fill("What is the escape velocity formula on page 3 and what value does this PDF give?");
    await composer.press("Enter");
    await expect(page.getByText(/11\.2/i).first()).toBeVisible({ timeout: 60_000 });

    // Click citation pill to open built-in PDF viewer at cited page
    const citeBtn = page.getByRole("button", { name: /p\.\s*3/i }).first();
    await expect(citeBtn).toBeVisible();
    await citeBtn.click();

    const viewerDialog = page.getByRole("dialog", { name: /PDF Viewer/i });
    await expect(viewerDialog).toBeVisible({ timeout: 15_000 });
    await expect(viewerDialog.getByLabel("PDF Page Number")).toHaveValue("3");
    const pageImg = viewerDialog.locator("img");
    await expect(pageImg).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => pageImg.evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 20_000 })
      .toBeGreaterThan(50);
    const modalPanelBox = await viewerDialog.locator("> div").first().boundingBox();
    expect(modalPanelBox).not.toBeNull();
    expect(modalPanelBox!.height).toBeGreaterThan(250);
    expect(modalPanelBox!.y).toBeGreaterThanOrEqual(0);
    expect(modalPanelBox!.y).toBeLessThan(200);
    await page.screenshot({ path: join(ARTIFACT_DIR, "03-desktop-1440-pdf-viewer.png") });

    // Toggle Extracted Text + test Zoom in + close viewer
    await viewerDialog.getByRole("button", { name: "Zoom in" }).click();
    await expect(viewerDialog.getByText("120%")).toBeVisible();
    await viewerDialog.getByRole("button", { name: "Extracted Text" }).click();
    await expect(viewerDialog.getByText(/11\.2 km\/s/i)).toBeVisible({ timeout: 10_000 });
    await viewerDialog.getByRole("button", { name: "Close PDF viewer" }).click();
    await expect(viewerDialog).toHaveCount(0);

    // Out-of-document question -> honest denial without fabricated citations
    await composer.fill("What does this PDF say about CRISPR-Cas9 gene editing in bacteria?");
    await composer.press("Enter");
    await expect(
      page.getByText(/could not find|not (?:found|mentioned|covered|present) in (?:the|this) (?:uploaded )?PDF/i).first()
    ).toBeVisible({ timeout: 60_000 });

    // 5. Responsive layout checks & screenshots (768x1024, 390x844, 360x800)
    for (const vp of [
      { width: 768, height: 1024, file: "04-tablet-768.png" },
      { width: 390, height: 844, file: "05-mobile-390.png" },
      { width: 360, height: 800, file: "06-mobile-360.png" },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(2);
      await page.screenshot({ path: join(ARTIFACT_DIR, vp.file) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // 6. Test B (Scanned image-only PDF via real UI "New PDF" -> real OCR pipeline)
    await page.getByRole("button", { name: /New PDF/i }).last().click();
    const secondInput = page.getByTestId("learn-with-pdf-file-input").last();
    await secondInput.setInputFiles(testBPath);
    await expect(page.getByText(/OCR \(1p\)/i).first()).toBeVisible({ timeout: 90_000 });

    await composer.fill("What measured resistance value is shown on page 1 of this scanned PDF?");
    await composer.press("Enter");
    await expect(page.getByText(/5\s*(?:Ohms?|Ω)/i).first()).toBeVisible({ timeout: 60_000 });

    // 7. Test C (Mixed PDF via bridge: verify OCR runs ONLY on scanned page 2)
    const mixedResult = await uploadPdfViaApi(context1.request, "test-c-mixed-optics.pdf", testCBytes, "e2e-user-1");
    expect(mixedResult.ok).toBe(true);
    expect(mixedResult.body.scannedPages).toEqual([2]);
    expect(mixedResult.body.ocrPages).toEqual([2]);

    // 8. Test D (Large ~23.8 MB valid PDF via 2 MB chunked upload & 206 range streaming)
    const largeResult = await uploadPdfViaApi(context1.request, "test-d-large-valid.pdf", testDBytes, "e2e-user-1");
    expect(largeResult.ok).toBe(true);
    expect(largeResult.body.pageCount).toBe(2);
    const rangeRes = await context1.request.get(
      `${BRIDGE_URL}/api/lam/pdf/${encodeURIComponent(largeResult.docId)}?file=1&offset=0`,
      { headers: { "X-Test-User-Id": "e2e-user-1" } }
    );
    expect(rangeRes.status()).toBe(206);

    // 9. Test E (Encrypted PDF rejected on /process with 422 PDF_PASSWORD_PROTECTED)
    const encResult = await uploadPdfViaApi(context1.request, "test-e-locked.pdf", encryptedBytes, "e2e-user-1");
    expect(encResult.ok).toBe(false);
    expect(encResult.status).toBe(422);

    // 10. Cross-user auth isolation check (e2e-user-2 vs e2e-user-1's largeResult doc)
    const user2List = await context2.request.get(`${BRIDGE_URL}/api/lam/pdf`, {
      headers: { "X-Test-User-Id": "e2e-user-2" },
    });
    expect(user2List.status()).toBe(200);
    const user2ListJson = (await user2List.json()) as { docs: Array<{ id: string }> };
    expect(user2ListJson.docs.some((d) => d.id === largeResult.docId)).toBe(false);

    const user2Get = await context2.request.get(
      `${BRIDGE_URL}/api/lam/pdf/${encodeURIComponent(largeResult.docId)}`,
      { headers: { "X-Test-User-Id": "e2e-user-2" } }
    );
    expect(user2Get.status()).toBe(404);

    const user2Exec = await context2.request.post(`${BRIDGE_URL}/api/lam/plugins/execute`, {
      headers: { Origin: BASE_URL, "X-Test-User-Id": "e2e-user-2" },
      data: {
        executionId: randomUUID(),
        pluginId: "learn-with-pdf",
        prompt: "Summarize this PDF",
        pdfDocId: largeResult.docId,
        scholarClass: 11,
      },
    });
    const user2ExecText = await user2Exec.text();
    expect(user2ExecText).toMatch(/"type":"error"|not found|404/i);
    expect(user2ExecText).not.toMatch(/THERMODYNAMICS|Isothermal/i);

    // 11. Delete via UI Trash button + verify Plugins directory lists Learn with PDF
    await page.getByRole("button", { name: "Delete uploaded PDF" }).last().click();
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("tab", { name: /Plugins/i }).click();
    await expect(page.getByText("Learn with PDF", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    expect(pageErrors).toEqual([]);
  } finally {
    await context1.close().catch(() => undefined);
    await context2.close().catch(() => undefined);
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
});
