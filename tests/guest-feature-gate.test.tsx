import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GuestFeatureGate } from "../src/components/guest/guest-feature-gate";

test("guest screen preserves privacy copy and exposes both reference actions", () => {
  const html = renderToStaticMarkup(<GuestFeatureGate onSignIn={() => {}} onBack={() => {}} />);
  expect(html).toContain('data-guest-feature-gate="true"');
  expect(html).toContain("Guest session");
  expect(html).toContain("Sign in to use this private feature");
  expect(html).toContain("Guest Mode does not provide cloud files, purchases, payments, subscriptions, or cross-device storage.");
  expect(html).toContain("Create account or Sign in");
  expect(html).toContain("Back to Scholar");
  expect(html.match(/<button type="button"/g)).toHaveLength(2);
  expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  expect(html).not.toContain("Scholar Plus");
});

test("the gate has unique accessible references and decorative graphics stay hidden", () => {
  const html = renderToStaticMarkup(<><GuestFeatureGate onSignIn={() => {}} onBack={() => {}} /><GuestFeatureGate onSignIn={() => {}} onBack={() => {}} reduceMotion /></>);
  const titles = [...html.matchAll(/<h1 id="([^"]+)"/g)].map((match) => match[1]);
  const descriptions = [...html.matchAll(/<p id="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(titles).size).toBe(2);
  expect(new Set(descriptions).size).toBe(2);
  for (const title of titles) expect(html).toContain(`aria-labelledby="${title}"`);
  for (const description of descriptions) expect(html).toContain(`aria-describedby="${description}"`);
  expect(html).toContain('aria-hidden="true" focusable="false"');
  expect(html).toContain('data-reduce-motion="true"');
  expect(html).toContain('data-reduce-motion="false"');
});
