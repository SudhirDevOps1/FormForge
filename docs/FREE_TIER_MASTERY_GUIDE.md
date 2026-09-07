# 🌟 FormForge: The Zero-Card Free Tier Mastery Guide

FormForge can run **100% free forever without requiring a credit card** across multiple deployment platforms and databases.

---

## 🏆 The Ultimate Zero-Card Free Tier Matrix

| Service | Role | Free Tier Capacity | Credit Card Required? |
| :--- | :--- | :--- | :--- |
| **Vercel** | Web & API Hosting | Unlimited Hobby deploys, 100GB bandwidth | ❌ No |
| **Netlify** | Web & API Hosting | 300 credits/mo (commercial use allowed) | ❌ No |
| **Cloudflare Workers** | Edge Hosting | 100k requests/day, edge routing | ❌ No |
| **Turso (libSQL)** | Primary Database | **100 databases, 5GB storage**, unlimited active | ❌ No |
| **Neon Postgres** | Serverless Postgres | **0.5GB storage, serverless autoscaling** | ❌ No |
| **Cloudflare D1** | SQLite Database | 500MB storage, 5M reads/day | ❌ No |
| **Google Apps Script** | Email Relay & Sheets | **500 - 1,500 emails/day** via Gmail | ❌ No |
| **Telegram Bot API** | Realtime Push Alerts | Unlimited push messages to phone/desktop | ❌ No |
| **ntfy.sh** | Instant Mobile Push | Free public/private topics, zero account | ❌ No |
| **Backblaze B2** | File Attachments (S3) | **10GB free storage forever** | ❌ No |
| **DuckDB (In-Browser)** | Data Analytics | 100% client-side WASM, zero server cost | ❌ No |

---

## 1. Hosting & Database Combinations

### Option A: Vercel + Turso (Recommended for Instant Deploy)
1. Fork or clone this repository.
2. Create a free database at [Turso.tech](https://turso.tech) (no card required):
   ```bash
   turso db create formforge-db
   turso db tokens create formforge-db
   ```
3. Import project into Vercel and configure environment variables:
   - `TURSO_DATABASE_URL`: `libsql://your-db-name-org.turso.io`
   - `TURSO_AUTH_TOKEN`: your Turso token
   - `AUTH_SECRET`: generate with `openssl rand -hex 32`
4. Deploy! Tables auto-migrate on first page load.

### Option B: Netlify + Turso
1. Connect repo to Netlify.
2. In Site configuration > Environment variables:
   - `TURSO_DATABASE_URL`: your Turso URL
   - `TURSO_AUTH_TOKEN`: your Turso token
   - `AUTH_SECRET`: your 64-char secret
3. Deploy!

### Option C: Cloudflare Workers + D1 (Edge Native)
1. In `wrangler.jsonc`, insert your D1 database id:
   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "formforge-db",
       "database_id": "YOUR-D1-DATABASE-ID"
     }
   ]
   ```
2. Deploy via `npm run deploy` (or connect to Cloudflare dashboard).

### Option D: Vercel / Netlify / Cloudflare + Neon Serverless Postgres
1. Create a free database at [Neon.tech](https://neon.tech) (no card required, 0.5GB free forever).
2. Copy your connection string from the Neon dashboard.
3. Configure environment variables in your deployment platform:
   - `NEON_DATABASE_URL`: `postgresql://user:pass@ep-cool-snowflake.region.aws.neon.tech/neondb?sslmode=require`
   - `AUTH_SECRET`: your 64-char hex secret
4. Deploy! Schema auto-creates on startup using Postgres DDL.

---

## 2. Free Email Notifications via Google Apps Script (GAS)

Google Apps Script gives you **1,500 free emails/day** (Google Workspace) or **500 free emails/day** (personal Gmail) with zero API keys or credit cards.

### Setup (Takes 60 seconds):
1. Go to [script.google.com](https://script.google.com) and click **New Project**.
2. Paste the following script:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // 1. Send free email via your personal Gmail
    if (data.emailTo) {
      MailApp.sendEmail({
        to: data.emailTo,
        subject: "New FormForge Submission: " + (data.form ? data.form.name : "Form"),
        body: JSON.stringify(data.payload, null, 2)
      });
    }
    
    // 2. Append row to active Google Sheet (optional)
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    if (sheet) {
      var row = [new Date(), data.form ? data.form.name : "", data.submission ? data.submission.id : ""];
      for (var key in data.payload) {
        row.push(data.payload[key]);
      }
      sheet.getActiveSheet().appendRow(row);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Click **Deploy > New Deployment**:
   - Select type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the Web App URL (starts with `https://script.google.com/macros/s/.../exec`).
5. In FormForge dashboard, open form **Settings > 100% Free-Tier Realtime Integrations** and paste your Web App URL in **Google Apps Script Webhook URL**.
6. Save! Form submissions now send emails and log directly to your Google Sheet for free!

---

## 3. Free Instant Push Alerts: Telegram & ntfy.sh

### Telegram Bot (Unlimited & Instant):
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`, choose a name and username. Copy the Bot Token (`123456789:ABC...`).
3. Search for `@userinfobot` on Telegram to get your numeric Chat ID (`987654321`).
4. In FormForge dashboard settings, paste your **Token** and **Chat ID**.
5. You will receive formatted instant push notifications on phone & desktop whenever someone submits your form!

### ntfy.sh (Zero Account Required):
1. Choose a private topic name, e.g. `formforge-my-contact-8821`.
2. In FormForge form settings, enter `formforge-my-contact-8821` in **ntfy.sh Topic**.
3. Install the free **ntfy** mobile app on Android or iOS and subscribe to `formforge-my-contact-8821`.
4. Receive instant native push alerts with sound and priority!

---

## 4. 🔐 6-Digit OTP Email Verification

To eliminate spam and verify email addresses without complicated links:
1. In form settings, turn on **Require 6-Digit OTP Verification for Submissions**.
2. Submitters receive a cryptographically generated 6-digit code with a 10-minute expiry.
3. Once verified, the submission is confirmed.
4. Uses your configured email provider or Google Apps Script relay!

---

## 5. Free 10GB File Attachment Storage (Backblaze B2)

Backblaze B2 gives **10GB free cloud storage forever** with zero credit card required:
1. Create a free account at [backblaze.com/b2](https://www.backblaze.com/cloud-storage).
2. Create a Bucket (e.g. `my-formforge-uploads`).
3. Create an Application Key under **App Keys**.
4. Set environment variables in Vercel / Netlify / Cloudflare:
   - `S3_ENDPOINT`: `https://s3.<your-b2-region>.backblazeb2.com`
   - `S3_BUCKET_NAME`: `my-formforge-uploads`
   - `S3_ACCESS_KEY_ID`: your B2 `keyID`
   - `S3_SECRET_ACCESS_KEY`: your B2 `applicationKey`
5. Form file uploads will automatically be stored securely in your private B2 bucket!

---

## 6. DuckDB Client-Side Analytics

- Inside your FormForge dashboard under **Analytics**, the DuckDB analytical view aggregates:
  - Total submissions, conversion rate, spam detection breakdown, and top referrers.
  - Generates analytical insights client-side without consuming any database query limits.
  - One-click exports to CSV & JSON format ready for DuckDB CLI, MotherDuck, or Pandas.

---

## 7. 🌐 Working on Free Subdomains (No Custom Domain Needed)

You do **NOT** need to buy a domain or configure DNS records to use FormForge in production:

| Platform | Free Subdomain Provided | HTTPS Included? | Cookies & Auth Compatible? |
|---|---|---|---|
| **Vercel** | `https://your-project.vercel.app` | ✅ Yes (Auto SSL) | ✅ Yes (`SameSite: Lax`, no Domain lock) |
| **Netlify** | `https://your-site.netlify.app` | ✅ Yes (Auto SSL) | ✅ Yes (`SameSite: Lax`, no Domain lock) |
| **Cloudflare Workers** | `https://your-worker.workers.dev` | ✅ Yes (Auto SSL) | ✅ Yes (`SameSite: Lax`, no Domain lock) |
| **Cloudflare Pages** | `https://your-project.pages.dev` | ✅ Yes (Auto SSL) | ✅ Yes (`SameSite: Lax`, no Domain lock) |

### Why it works:
1. **Host-Only Cookies**: FormForge issues cookies without a restrictive `Domain=...` attribute. The browser scopes authentication cookies directly to your free subdomain.
2. **Universal CORS**: Form endpoint allows submissions from anywhere by default (`allowed_origins = "*"`), so your static websites on GitHub Pages, GitLab Pages, Netlify, Vercel, or WordPress can submit data to your FormForge subdomain without CORS issues.

---

## 8. 🛡️ Credentials Classification: Plain Text vs Secrets

When configuring your deployment (in `.env`, Vercel Dashboard, Netlify Site Configuration, or Cloudflare Settings):

### 🔴 Sensitive Secrets (Must be Encrypted / Private Secrets)
Never commit these in GitHub. In Vercel / Netlify / Cloudflare, mark them as **Secret / Encrypted**:

| Variable | Description | Where to Get |
|---|---|---|
| `AUTH_SECRET` | 64-char key for session & API key HMAC encryption | `openssl rand -hex 32` |
| `TURSO_AUTH_TOKEN` | Turso database JWT authentication token | `turso db tokens create formforge-db` |
| `NEON_DATABASE_URL` | Neon Serverless Postgres connection string | [neon.tech](https://neon.tech) Console |
| `RESEND_API_KEY` | Resend email API key | [resend.com/api-keys](https://resend.com) |
| `BREVO_API_KEY` | Brevo email API key | [brevo.com](https://brevo.com) |
| `SENDGRID_API_KEY` | SendGrid API key | [sendgrid.com](https://sendgrid.com) |
| `MAILGUN_API_KEY` | Mailgun API key | [mailgun.com](https://mailgun.com) |
| `SMTP_PASS` | Custom SMTP password or Gmail App Password | Google Account → Security → App passwords |
| `S3_SECRET_ACCESS_KEY` / `B2_APPLICATION_KEY` | Backblaze B2 Application Key | Backblaze Console → App Keys |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot token | Telegram `@BotFather` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile CAPTCHA secret | Cloudflare Dashboard → Turnstile |

### 🟢 Plain Text / Public Variables (Safe as Standard Env Vars)
These are non-sensitive configuration values:

| Variable | Recommended Value | Note |
|---|---|---|
| `APP_NAME` | `FormForge` | Display name in dashboard |
| `ALLOW_REGISTRATION` | `true` or `false` | `false` locks registration to owner only |
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` | Database host URL |
| `GAS_URL` | `https://script.google.com/macros/s/.../exec` | Public Google Apps Script Web App URL |
| `TELEGRAM_CHAT_ID` | `987654321` | Numeric Telegram user or group ID |
| `NTFY_TOPIC` | `your-private-topic` | Topic name for mobile alerts |
| `S3_ENDPOINT` / `B2_ENDPOINT` | `https://s3.us-west-004.backblazeb2.com` | S3 / B2 endpoint URL |
| `S3_BUCKET_NAME` / `B2_BUCKET_NAME` | `my-form-uploads` | S3 bucket name |
| `S3_ACCESS_KEY_ID` / `B2_APPLICATION_KEY_ID` | `004...` | Public identifier key ID |
| `S3_REGION` | `us-west-004` | Region code |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP host |
| `SMTP_PORT` | `587` | Standard submission port |
| `SMTP_USER` | `yourname@gmail.com` | Email address |
| `SMTP_FROM` | `yourname@gmail.com` | Sender address |
| `SMTP_ENABLED` | `true` or `false` | Enable custom SMTP |

