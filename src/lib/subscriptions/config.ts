import "server-only";

function bool(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  return fallback;
}

function integer(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

export function areSubscriptionsEnabled() {
  return bool("SUBSCRIPTIONS_ENABLED", true);
}

export const subscriptionConfig = {
  // Fail closed: a missing or malformed flag keeps subscriptions enforced.
  // Only an explicit false/0/off/no value globally unlocks Scholar.
  enabled: areSubscriptionsEnabled(),
  regularPriceInr: integer("SCHOLAR_PLUS_REGULAR_PRICE_INR", 300),
  offerPriceInr: integer("SCHOLAR_PLUS_OFFER_PRICE_INR", 100),
  offerEnabled: bool("SCHOLAR_PLUS_OFFER_ENABLED", true),
  offerLabel: process.env.SCHOLAR_PLUS_OFFER_LABEL?.trim() || "Inauguration Offer",
  offerEndAt: process.env.SCHOLAR_PLUS_OFFER_END_AT?.trim() || null,
  billingInterval: process.env.SCHOLAR_PLUS_BILLING_INTERVAL?.trim() || null,
  durationDays: integer("SCHOLAR_PLUS_DURATION_DAYS", 0) || null,
  freeStorageMb: integer("FREE_STORAGE_LIMIT_MB", 30),
  plusStorageMb: integer("PLUS_STORAGE_LIMIT_MB", 1024),
  freeQuizGenerations: integer("FREE_DAILY_QUIZ_GENERATIONS", 3),
  freeSlideshowGenerations: integer("FREE_DAILY_SLIDESHOW_GENERATIONS", 3),
  plusQuizGenerations: integer("PLUS_DAILY_QUIZ_GENERATIONS", -1),
  plusSlideshowGenerations: integer("PLUS_DAILY_SLIDESHOW_GENERATIONS", -1),
  upiQrAsset: process.env.SCHOLAR_UPI_QR_ASSET?.trim() || "/payments/scholar-plus-upi.jpg",
  upiId: process.env.SCHOLAR_UPI_ID?.trim() || "8086327212@fam",
  upiPhone: process.env.SCHOLAR_UPI_PHONE?.trim() || "8086327212",
  paymentRecipient: process.env.SCHOLAR_PAYMENT_RECIPIENT_NAME?.trim() || "Ishan Salah",
  adminPaymentEmail: process.env.SCHOLAR_ADMIN_PAYMENT_EMAIL?.trim().toLowerCase() || null,
  resendFromEmail: process.env.RESEND_FROM_EMAIL?.trim() || null,
  promoOpenFrequency: Math.max(1, integer("SUBSCRIPTION_PROMPT_OPEN_FREQUENCY", 4)),
  installDismissDays: Math.max(1, integer("INSTALL_PROMPT_DISMISS_DAYS", 14)),
} as const;

export function currentPlusPriceInr() {
  if (!subscriptionConfig.offerEnabled) return subscriptionConfig.regularPriceInr;
  if (!subscriptionConfig.offerEndAt) return subscriptionConfig.offerPriceInr;
  const end = Date.parse(subscriptionConfig.offerEndAt);
  return Number.isFinite(end) && end > Date.now()
    ? subscriptionConfig.offerPriceInr
    : subscriptionConfig.regularPriceInr;
}

export function publicSubscriptionConfig() {
  return {
    subscriptionsEnabled: subscriptionConfig.enabled,
    regularPriceInr: subscriptionConfig.regularPriceInr,
    offerPriceInr: subscriptionConfig.offerPriceInr,
    offerEnabled: subscriptionConfig.offerEnabled,
    offerLabel: subscriptionConfig.offerLabel,
    offerEndAt: subscriptionConfig.offerEndAt,
    billingInterval: subscriptionConfig.billingInterval,
    durationDays: subscriptionConfig.durationDays,
    freeStorageMb: subscriptionConfig.freeStorageMb,
    plusStorageMb: subscriptionConfig.plusStorageMb,
    freeQuizGenerations: subscriptionConfig.freeQuizGenerations,
    freeSlideshowGenerations: subscriptionConfig.freeSlideshowGenerations,
    promoOpenFrequency: subscriptionConfig.promoOpenFrequency,
    installDismissDays: subscriptionConfig.installDismissDays,
    checkoutConfigured: Boolean(
      subscriptionConfig.upiQrAsset &&
      (subscriptionConfig.upiId || subscriptionConfig.upiPhone) &&
      subscriptionConfig.paymentRecipient,
    ),
  };
}
