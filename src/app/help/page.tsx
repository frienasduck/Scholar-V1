import { InformationPage } from "@/components/information-page";
export const metadata = { title: "Help & feedback | Scholar" };
export default function HelpPage() {
  return <InformationPage title="Help & feedback" intro="Get back to studying with a few practical checks.">
    <section><h2>AI isn't responding</h2><p>Sign in, check your connection, and try a short question. Generate long documents in smaller sections. If an allowance is reached, check the reset information in Settings. A failed generation should show an error instead of an endless spinner.</p></section>
    <section><h2>Find your work</h2><p>Use Search or Ctrl/⌘ K to find a feature. Many study records and files are saved locally in this browser. Return to the same account and browser profile, and export important notes before clearing browser data.</p></section>
    <section><h2>Video or audio won't play</h2><p>Press play inside the player; some browsers require that gesture. If an embedded lesson is unavailable, use its YouTube link. Check device volume and browser media permissions.</p></section>
    <section><h2>Report a problem</h2><p>Open an issue on the <a href="https://github.com/frienasduck/Scholar-V1/issues" target="_blank" rel="noreferrer">Scholar project</a> with the feature name, browser, and steps that reproduce the problem. Issues are public: omit passwords, account details, private study content, and payment proof.</p></section>
  </InformationPage>;
}
