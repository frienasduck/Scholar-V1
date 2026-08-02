# Scholar Plus deployment configuration

Scholar Plus is server-authoritative. Keep `SUBSCRIPTIONS_ENABLED=false` until a durable production database, payment recipient, admin account, session secret, and email provider are ready. With the switch disabled, Scholar deliberately grants all entitlements and suppresses paywalls, Plus promotions, quotas, and checkout.

## Required before enabling subscriptions

- Use a durable Prisma-compatible production database. The repository's local SQLite database is for local development and is not durable on Vercel Functions.
- Set `AUTH_SESSION_SECRET` to a random value of at least 32 characters.
- Set `SCHOLAR_ADMIN_PAYMENT_EMAIL` to the account that is allowed to review requests. Register/sign in with that exact address so its database role becomes `admin`.
- Set `SCHOLAR_UPI_QR_ASSET`, either `SCHOLAR_UPI_ID` or `SCHOLAR_UPI_PHONE`, and `SCHOLAR_PAYMENT_RECIPIENT_NAME`.
- Set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` to enable payment notifications.
- Generate a scrypt Developer Mode password hash and set `DEV_MODE_PASSWORD_HASH`; never store the plain password in source or a public variable.
- Apply the Prisma schema before enabling the switch.

## Product configuration

Pricing, optional duration/billing labels, free and Plus storage, daily generation quotas, promotion frequency, and install-prompt cooldown are configured with the variable names listed in `.env.example`. No billing interval is displayed unless one is explicitly configured.

## Safe enablement order

1. Provision the durable database and apply the Prisma schema.
2. Configure secrets in both Preview and Production as appropriate.
3. Test registration, login, payment submission, private proof access, admin review, rejection, approval, one-time coin grant, quotas, and entitlement expiry in Preview.
4. Set `SUBSCRIPTIONS_ENABLED=true` only after those checks pass.

An email button only opens the protected admin review page. Approval always requires a current authenticated admin session and a separate server-side mutation.
