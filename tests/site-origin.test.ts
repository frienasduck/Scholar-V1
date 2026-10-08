import { afterAll, beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const { authBaseUrl } = await import("../src/lib/auth/config");
const { default: sitemap } = await import("../src/app/sitemap");
const previous = { NODE_ENV: process.env.NODE_ENV, AUTH_BASE_URL: process.env.AUTH_BASE_URL, SCHOLAR_ENVIRONMENT: process.env.SCHOLAR_ENVIRONMENT };
beforeEach(() => { Object.assign(process.env, { NODE_ENV: "production" }); delete process.env.AUTH_BASE_URL; delete process.env.SCHOLAR_ENVIRONMENT; });
afterAll(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

test("production OAuth/recovery and public sitemap use the actual Scholar domain", () => {
  expect(authBaseUrl()).toBe("https://scholarofficial.vercel.app");
  for (const item of sitemap()) expect(new URL(item.url).origin).toBe(authBaseUrl());
  expect(sitemap().some(item => /ebook|account|settings/.test(item.url))).toBe(false);
});
test("local development and explicit HTTPS staging origin remain supported", () => {
  Object.assign(process.env, { NODE_ENV: "development" }); expect(authBaseUrl()).toBe("http://localhost:3000");
  process.env.AUTH_BASE_URL = "https://scholar-staging.example/"; expect(authBaseUrl()).toBe("https://scholar-staging.example");
});
test("invalid origins cannot redirect credentials or recovery tokens", () => {
  for (const value of ["http://localhost:3000", "http://evil.example", "https://user:pass@scholar.example", "https://scholar.example/path", "https://scholar.example/?next=evil", "https://scholar.example/#evil", "javascript:alert(1)"]) {
    process.env.AUTH_BASE_URL = value; expect(authBaseUrl).toThrow();
  }
});
test("isolated staging metadata does not advertise the production site", () => {
  process.env.SCHOLAR_ENVIRONMENT = "staging";
  process.env.AUTH_BASE_URL = "https://scholar-staging.vercel.app";
  for (const item of sitemap()) expect(new URL(item.url).origin).toBe(authBaseUrl());
});
