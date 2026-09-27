import type { NextConfig } from "next";

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
    "/api/group-study/pdf-worker": ["./node_modules/pdfjs-dist/build/pdf.worker.min.mjs"],
    "/api/group-study/rooms/*/resources": [
      "./node_modules/pdfjs-dist/legacy/build/*.mjs",
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
    "/api/ocr": [
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js/package.json",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/zlibjs/**/*",
      "./node_modules/bmp-js/**/*",
    ],
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
