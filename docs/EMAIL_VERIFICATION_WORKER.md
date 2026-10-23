# Email verification codes on the Cloudflare Worker

The 6-digit sign-in codes are now sent and checked by the existing Cloudflare Worker
(`top-admin/worker`, routes `/auth/...`), not Firebase Cloud Functions. Cloud Functions need the paid
Blaze plan and were never deployed, which is why "Resend code" said **not-found**.

Same rules as before: codes expire after 10 minutes, 5 wrong tries lock the code, 60 seconds between
resends, at most 5 codes per hour. Codes are stored only as HMAC hashes, and each code is emailed to the
signed-in account's own address (taken from the verified Firebase sign-in token, never from the app).

## One-time setup (about 10 minutes)

Run these in a terminal inside `top-admin/worker`:

```bash
npx wrangler login
```

### 1. Create the code storage (Cloudflare KV, free)

```bash
npx wrangler kv namespace create OTP_KV
```

It prints an `id`. Open `top-admin/worker/wrangler.toml`, find the commented `[[kv_namespaces]]`
block at the bottom, remove the `#` from its three lines and paste the id:

```toml
[[kv_namespaces]]
binding = "OTP_KV"
id = "the-id-it-printed"
```

### 2. Choose an email service (free) and get an API key

| Service | Free tier | Sender needs |
|---|---|---|
| **Brevo** (brevo.com) | 300 emails/day | Just verify one sender address (e.g. your Gmail). Easiest if you have no domain. |
| **Resend** (resend.com) | 3,000/month | A domain you own, verified with DNS records. Best deliverability. |

- Brevo: Settings → **Senders & IPs** → add and verify the sender address → **SMTP & API → API keys** → create key.
- Resend: **Domains** → add your domain and the DNS records → **API Keys** → create key.

Set the sender in `wrangler.toml` (`MAIL_FROM`) to that verified address, for example
`MAIL_FROM = "Testimonies of Praise <youraddress@gmail.com>"`.

### 3. Add the secrets (never put them in git)

```bash
npx wrangler secret put OTP_PEPPER
```
Paste any long random text (for example 40+ random letters and numbers). Keep it the same forever:
changing it invalidates codes that are in flight (trusted devices are not affected).

Then **one** of:
```bash
npx wrangler secret put BREVO_API_KEY
```
```bash
npx wrangler secret put RESEND_API_KEY
```

### 4. Deploy

```bash
npm install
npm test
npx wrangler deploy
```

### 5. Check it

```bash
curl -s -X POST https://top-push-relay.gtrusouth116.workers.dev/auth/session/trust
```
Expected: `{"error":"Sign-in required.","code":"unauthenticated"}` — the route exists and is protected.
(Before deploying you get `{"status":"ok"}` or `not-found` instead.)

Then in the app: sign in, tap **Resend code** after 60 seconds, enter the code from the email.

## Does the app need a rebuild?

Yes, once. APKs built before this change still call the missing Cloud Functions. After the Worker
is deployed, run `git pull`, `npm install` and `npm run build:android:apk`, and install the new APK.

## Limits to know

- Cloudflare KV free plan: 1,000 writes per day. Each code sent or checked uses about one write;
  that's several hundred sign-ins a day. If you outgrow it, the Workers Paid plan ($5/month) raises it.
- Brevo free: 300 emails/day.
- Codes sent from a Gmail address through Brevo can land in spam; a verified domain avoids that.

## Files

- Worker: `top-admin/worker/src/auth.js` (logic), `src/index.js` (routes), `test-auth.mjs` (tests)
- App: `src/api/authService.ts` (calls), `EXPO_PUBLIC_AUTH_API_URL` in `eas.json` (Worker address)
- `backend-reference/functions/` still holds the old Cloud Functions version; it is no longer used for
  verification.
