import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PlusFeaturePreview } from "../src/components/subscriptions/plus-feature-preview";
import type { ScholarEntitlement } from "../src/lib/subscriptions/entitlements";

test("reference preview uses three real capability cards and keeps saved-work assurance", () => {
  const html = renderToStaticMarkup(<PlusFeaturePreview entitlement="scholar_intelligence" title="Scholar Intelligence" description="Turn learning evidence into mastery." />);
  expect(html).toContain('data-plus-preview="scholar_intelligence"');
  expect(html.match(/<li[ >]/g)).toHaveLength(3);
  expect(html).toContain("Review learning evidence");
  expect(html).toContain("Spot gaps and patterns");
  expect(html).toContain("viewing this preview does not change your plan");
  expect(html).toContain("Explore Scholar Plus");
  expect(html).toContain("Back to Scholar");
  expect(html).not.toContain("backdrop-filter");
});

test("all section locks render the same labelled structure with section-specific content", () => {
  const sections: ScholarEntitlement[] = ["levels", "assignments", "practical_lab", "derivation_library", "formula_explorer", "python_workspace", "lam_ai", "aisig", "homework_scanner", "premium_experiments", "slideshow_generation_plus", "workspace_ai"];
  for (const entitlement of sections) {
    const html = renderToStaticMarkup(<PlusFeaturePreview entitlement={entitlement} title={`Preview ${entitlement}`} description="Section description" />);
    expect(html.match(/<li[ >]/g)).toHaveLength(3);
    expect(html).toContain(`aria-label="Preview ${entitlement} preview"`);
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
    if (entitlement !== "aisig") expect(html).not.toContain("Generate a visual study aid</h2>");
  }
});

test("custom capabilities, CTA and illustrative content remain supported", () => {
  const html = renderToStaticMarkup(<PlusFeaturePreview entitlement="workspace_ai" title="Workspace" description="Your workspace" featureBullets={["Custom capability"]} ctaLabel="View plans" visualPreview={<p>Illustration</p>} onBack={() => {}} />);
  expect(html).toContain("Custom capability");
  expect(html).toContain("View plans");
  expect(html).toContain("Illustration");
});
