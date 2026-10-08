import { beforeEach, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

let session: { status: string; loading: boolean; authenticated: boolean; user?: { id: string; email: string } };
let account: { authed: boolean; guestMode: boolean; onboarded: boolean; devMode: boolean; user: { email: string; scholarClass: number } };
const Wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;
mock.module("../src/lib/store", () => ({ useStore: (selector: (state: unknown) => unknown) => selector(account), activateAccountWorkspace: () => false }));
mock.module("../src/components/subscriptions/subscription-provider", () => ({ SubscriptionProvider: Wrapper, useScholarAccess: () => session }));
mock.module("../src/components/auth-screen", () => ({ AuthScreen: () => <p>Sign in screen</p> }));
mock.module("../src/components/onboarding", () => ({ Onboarding: () => <p>Onboarding</p> }));
mock.module("../src/components/app-shell", () => ({ AppShell: () => <p>Private account A workspace</p> }));
mock.module("../src/components/personalization/personalization-provider", () => ({ PersonalizationProvider: Wrapper }));
mock.module("../src/components/scholar-transition", () => ({ ScholarTransitionProvider: Wrapper }));
mock.module("../src/components/launch-readiness-gate", () => ({ LaunchReadinessGate: Wrapper, useLaunchContentReadiness: () => ({ reportShellReady: () => {} }) }));
const { AppContent } = await import("../src/components/app-content");
beforeEach(() => {
  account = { authed: true, guestMode: false, onboarded: true, devMode: false, user: { email: "a@example.test", scholarClass: 11 } };
  session = { status: "authenticated", loading: false, authenticated: true, user: { id: "a", email: "a@example.test" } };
});
const html = () => renderToStaticMarkup(<AppContent />);
test("explicit account switch unmounts prior account content while new session resolves", () => {
  session = { status: "refreshing", loading: true, authenticated: false };
  expect(html()).toContain("Checking your Scholar session"); expect(html()).not.toContain("Private account A workspace");
});
test("silent refresh keeps verified workspace smooth, not blanked on every focus", () => {
  session.status = "refreshing"; expect(html()).toContain("Private account A workspace");
});
test("server sign-out blocks private shell before local logout effect runs", () => {
  session = { status: "unauthenticated", loading: false, authenticated: false };
  expect(html()).toContain("Sign in screen"); expect(html()).not.toContain("Private account A workspace");
});
test("switch error never falls back to prior local account content", () => {
  session = { status: "error", loading: false, authenticated: false };
  expect(html()).toContain("couldn&#x27;t check your session"); expect(html()).not.toContain("Private account A workspace");
});
test("new account cannot render old account's local workspace before restoration", () => {
  session.user = { id: "b", email: "b@example.test" };
  expect(html()).toContain("Opening your account"); expect(html()).not.toContain("Private account A workspace");
});
