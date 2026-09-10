import { InformationPage } from "@/components/information-page";
export const metadata = { title: "Using Scholar | Scholar" };
export default function TermsPage() {
  return <InformationPage title="Using Scholar" intro="Practical guidance for responsible learning and keeping your work safe.">
    <section><h2>Study assistance</h2><p>Scholar is a learning aid. AI answers can contain mistakes; check important answers against your textbook and teacher's guidance. Use study tools to build understanding and follow your school's assessment rules.</p></section>
    <section><h2>Your content</h2><p>Upload or share only content you are allowed to use. Keep backups of important local notes and files. Features marked as previews may be incomplete and should not be relied on for purchases or real social communication.</p></section>
    <section><h2>Scholar Plus</h2><p>Review the current benefits, allowance, price, and payment instructions on <a href="/plus">Scholar Plus</a> before submitting a payment. Payment requests are reviewed through the existing approval process; a submitted proof is not confirmation of activation.</p></section>
    <section><h2>Questions or problems</h2><p>See <a href="/help">Help & feedback</a> for troubleshooting and the project support channel. Never publish account credentials or payment proof in a public issue.</p></section>
  </InformationPage>;
}
