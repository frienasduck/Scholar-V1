/**
 * Shared TTS voice preference (pure, unit-testable — no browser APIs).
 *
 * Used by Study Music promotions, Talk Reminders, LAM voice output and
 * accessibility speech. This is a PREFERENCE HEURISTIC: `getVoices()`
 * exposes device/browser voices, so Scholar never guarantees a particular
 * voice exists. Gender is inferred from names — never claimed as reliable.
 *
 * Selection order (default):
 *   Microsoft + en-GB + known female-like name
 *   → en-GB preferred female-like voice
 *   → any en-GB voice
 *   → stored preferred URI when it still exists
 *   → system default
 */

export interface TTSVoiceCandidate {
  name: string;
  lang: string;
  voiceURI: string;
  default: boolean;
}

export interface TTSVoicePreference {
  locale: string;
  preferredVendor?: string;
  preferredGender?: "female" | "male";
  preferredNames?: string[];
}

export const DEFAULT_TTS_VOICE_PREFERENCE: TTSVoicePreference = {
  locale: "en-GB",
  preferredVendor: "microsoft",
  preferredGender: "female",
  preferredNames: ["sonia", "libby", "abbi", "bella", "hollie", "olivia"],
};

export const KNOWN_FEMALE_HINTS = [
  "female", "woman", "girl", "zira", "hazel", "susan", "kate", "moira",
  "sonia", "ava", "emma", "samantha", "victoria", "fiona", "tessa",
  "serena", "harriet", "libby", "abbi", "hollie", "olivia", "bella", "jenny",
];

export function isFemaleLikeVoice(voice: Pick<TTSVoiceCandidate, "name">): boolean {
  const name = voice.name.toLowerCase();
  return KNOWN_FEMALE_HINTS.some((hint) => name.includes(hint));
}

export function normalizeLang(lang: string | undefined): string {
  return (lang ?? "").toLowerCase().replace("_", "-");
}

/** Per the blueprint scoring function. Higher is better. */
export function scoreScholarVoice(voice: TTSVoiceCandidate): number {
  let score = 0;
  const name = voice.name.toLowerCase();
  const lang = normalizeLang(voice.lang);

  if (lang === "en-gb") score += 100;
  if (name.includes("microsoft")) score += 50;

  const preferredFemaleNames = DEFAULT_TTS_VOICE_PREFERENCE.preferredNames ?? [];
  if (preferredFemaleNames.some((candidate) => name.includes(candidate))) score += 30;
  if (isFemaleLikeVoice(voice)) score += 10;

  if (voice.default) score += 1;
  return score;
}

export function selectTTSVoice(
  voices: TTSVoiceCandidate[],
  preference: TTSVoicePreference = DEFAULT_TTS_VOICE_PREFERENCE,
  storedVoiceURI?: string,
): TTSVoiceCandidate | null {
  if (!voices.length) return null;

  // A stored explicit choice wins while it still exists on this device.
  if (storedVoiceURI) {
    const stored = voices.find((voice) => voice.voiceURI === storedVoiceURI);
    if (stored) return stored;
  }

  const locale = normalizeLang(preference.locale);
  const inLocale = voices.filter((voice) => normalizeLang(voice.lang).startsWith(locale));
  const vendor = preference.preferredVendor?.toLowerCase();
  const gender = preference.preferredGender;

  // Microsoft + locale + gender-like → locale + gender-like → locale → default
  if (vendor && gender) {
    const precise = inLocale.find(
      (voice) => voice.name.toLowerCase().includes(vendor) && (gender === "female" ? isFemaleLikeVoice(voice) : !isFemaleLikeVoice(voice)),
    );
    if (precise) return precise;
  }
  if (gender) {
    const gendered = inLocale.find((voice) => (gender === "female" ? isFemaleLikeVoice(voice) : !isFemaleLikeVoice(voice)));
    if (gendered) return gendered;
  }
  // Locale exhausted → system default. Never reach into another locale just
  // to satisfy a vendor/gender preference (e.g. an en-US Microsoft voice).
  if (inLocale.length) return inLocale[0];
  return voices.find((voice) => voice.default) ?? voices[0] ?? null;
}

export function describeTTSVoice(voice: TTSVoiceCandidate | null): string {
  if (!voice) return "System default voice";
  return `${voice.name} (${voice.lang})`;
}
