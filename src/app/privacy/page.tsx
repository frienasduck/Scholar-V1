import { InformationPage } from "@/components/information-page";
export const metadata = { title: "Privacy & data | Scholar" };
export default function PrivacyPage() {
  return <InformationPage title="Privacy & your data" intro="Understand what stays on this device and what is sent to Scholar's services.">
    <section><h2>Your study workspace</h2><p>Notes, study progress, preferences, and many generated materials are stored in this browser. Uploaded file content uses this browser's local database, not cloud backup. Switching accounts preserves a local copy of the previous workspace; these copies are not encrypted. Use your own browser profile on shared devices. Export important work before clearing browser data or changing devices.</p></section>
    <section><h2>Accounts and subscriptions</h2><p>Scholar uses a server session cookie to keep you signed in. Account details, subscription status, payment requests, file quota metadata, and supported learning evidence are processed by Scholar's backend. Developer access and subscription access are checked separately.</p></section>
    <section><h2>AI and media</h2><p>When you ask an AI tool, its prompt and relevant context are sent to the configured AI provider. LAM can include the page context and material you select. Recorded voice is sent for transcription only when you use that feature. Embedded YouTube players and external background media contact their respective services.</p></section>
    <section><h2>Your controls</h2><p>Review AI context, microphone, notification, and data settings in <a href="/settings">Settings</a>. Avoid submitting passwords or sensitive personal information in prompts. Use the project's <a href="/help">support channel</a> for account and data questions.</p></section>
  </InformationPage>;
}
