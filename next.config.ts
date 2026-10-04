import type { NextConfig } from "next";
const pdfRuntimeFiles = ["./node_modules/pdfjs-dist/legacy/build/*.mjs", "./node_modules/pdfjs-dist/package.json", "./node_modules/pdfjs-dist/standard_fonts/**/*", "./node_modules/pdfjs-dist/cmaps/**/*", "./node_modules/pdfjs-dist/wasm/**/*", "./node_modules/@napi-rs/canvas*/**/*"];
const ocrTraceExcludes = [
  "./node_modules/**/*.map",
  "./node_modules/.prisma/client/*.tmp*",
  // This app uses Prisma's native library engine, not its browser/edge WASM
  // engines. Keep the platform query_engine binary and library.js untouched.
  "./node_modules/@prisma/client/runtime/query_engine_bg.*",
  "./node_modules/@prisma/client/runtime/query_compiler_bg.*",
  // recognizePageImage always requests OEM.LSTM_ONLY. Keep every LSTM SIMD
  // variant; the legacy recognition cores cannot be selected by this worker.
  "./node_modules/tesseract.js-core/tesseract-core.wasm*",
  "./node_modules/tesseract.js-core/tesseract-core-simd.wasm*",
  "./node_modules/tesseract.js-core/tesseract-core-relaxedsimd.wasm*",
];

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  poweredByHeader: false,
  // Authorization codes/state must not be printed by Next's development logger.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/google\/callback/] } },
  // OCR launches a native Node worker; its runtime require() tree is not part
  // of the route's JS bundle. Preserve it explicitly for serverless deployment.
  serverExternalPackages: ["tesseract.js", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/ebooks": pdfRuntimeFiles,
    "/api/ebooks/*": pdfRuntimeFiles,
    "/api/resources/*": pdfRuntimeFiles,
    "/api/group-study/pdf-worker": ["./node_modules/pdfjs-dist/build/pdf.worker.min.mjs"],
    "/api/group-study/rooms/*/resources": [
      "./node_modules/pdfjs-dist/legacy/build/*.mjs",
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
    "/api/ocr": [
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*",
      "./node_modules/@tesseract.js-data/eng/package.json",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js/package.json",
      "./node_modules/tesseract.js-core/*lstm*",
      "./node_modules/tesseract.js-core/package.json",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/zlibjs/**/*",
      "./node_modules/bmp-js/**/*",
    ],
    "/api/ebooks/*/ocr": [...pdfRuntimeFiles, "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*", "./node_modules/@tesseract.js-data/eng/package.json", "./node_modules/tesseract.js/src/**/*", "./node_modules/tesseract.js/package.json", "./node_modules/tesseract.js-core/*lstm*", "./node_modules/tesseract.js-core/package.json", "./node_modules/wasm-feature-detect/**/*", "./node_modules/regenerator-runtime/**/*", "./node_modules/is-url/**/*", "./node_modules/zlibjs/**/*", "./node_modules/bmp-js/**/*"],
  },
  outputFileTracingExcludes: {
    // Never package abandoned Prisma downloads, debug maps, or alternative
    // scan directories the supported built-in OCR endpoint does not read.
    "/api/ocr": [...ocrTraceExcludes, "./public/ebook-pages-*-clean/**/*"],
    "/api/ebooks/*/ocr": [...ocrTraceExcludes, "./node_modules/@tesseract.js-data/eng/4.0.0/**/*"],
  },
  env: {
    // Public deployment identity used only to invalidate non-sensitive startup warm-up markers.
    NEXT_PUBLIC_APP_BUILD_ID:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.npm_package_version ??
      "scholar-local",
  },
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(self), geolocation=()",
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
    ];
    return [
      {
        source: "/api/auth/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }],
      },
      { source: "/login", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
