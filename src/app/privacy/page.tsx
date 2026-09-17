import { InformationPage } from "@/components/information-page";
import { DeveloperAccessSection } from "@/components/developer-access-section";

export const metadata = { title: "Privacy & data | Scholar" };

export default function PrivacyPage() {
  return (
    <InformationPage title="Privacy & your data" intro="Understand what stays on this device and what is sent to Scholar's services.">
      <section>
        <h2>Information Scholar processes</h2>
        <p>Scholar keeps your study workspace usable on this device and processes the minimum account information needed to run the service. This notice describes the categories of information involved in using Scholar during the private beta. It is a plain-language summary, not an exhaustive legal document, and it may be updated as Scholar evolves.</p>
      </section>
      <section>
        <h2>Account information</h2>
        <p>If you sign in with a Scholar account, Scholar processes your email address, display name, selected class, and security settings such as your password (stored only as a salted hash) and server session. Sessions use an HttpOnly cookie and can be signed out at any time from Scholar's settings.</p>
      </section>
      <section>
        <h2>Guest Mode</h2>
        <p>Guest Mode runs without an account. Guest preferences and study activity stay in this browser's local storage and are never copied to Scholar's servers. Clearing your browser data removes them; converting a guest session to an account keeps your appearance preferences but does not upload guest history.</p>
      </section>
      <section>
        <h2>Group Study</h2>
        <p>When you join a Group Study room, Scholar processes your display name, the room code you enter, and your room activity such as chat messages, raised hands, quiz answers, and uploaded room materials. Room sessions are authorized by a room-scoped cookie; joining only requires a name and a valid code. Hosts see join requests and can approve, deny, mute, or remove participants.</p>
      </section>
      <section>
        <h2>Uploaded study materials</h2>
        <p>Files you upload for your own study are stored in this browser's local database and never leave your device. Materials uploaded to a Group Study room are processed by Scholar's backend so other participants can view them, and are removed when the room ends. Avoid uploading files containing sensitive personal data of others.</p>
      </section>
      <section>
        <h2>AI interactions</h2>
        <p>When you use an AI feature, the prompt and the context you allow (such as selected text or page content) are sent to the configured AI provider to generate a response. Prompts are not used to build advertising profiles. You can limit what AI features can see in Settings, and voice input is transcribed only when you actively use it.</p>
      </section>
      <section>
        <h2>Cookies and session information</h2>
        <p>Scholar uses a small number of essential cookies: a session cookie that keeps you signed in, room-scoped cookies that keep Group Study sessions working, and security cookies that protect forms against abuse. Scholar does not use advertising or cross-site tracking cookies.</p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Scholar protects accounts with salted password hashing, signed HttpOnly session cookies, server-side authorization checks on protected features, and rate limiting on sensitive actions. Beta access is verified on every request. No method of transmission over the internet is perfectly secure, so please use a unique password and your own browser profile on shared devices.</p>
      </section>
      <section>
        <h2>Data retention</h2>
        <p>Local study data stays until you clear it. Server account data is kept while your account is active. Group Study rooms and their materials expire automatically after the room lifetime, and removed or ended rooms stop accepting requests. Signing out revokes the current session on the server.</p>
      </section>
      <section>
        <h2>Contact and privacy information</h2>
        <p>Questions about this notice or your data can be sent to Scholar's support channel from the Help &amp; feedback page. During the private beta, beta access questions go to the Scholar contact address shown on the sign-in page.</p>
      </section>
      <DeveloperAccessSection />
    </InformationPage>
  );
}
