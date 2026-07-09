# 📋 FormForge Production Limitations & Specifications

This document outlines the architectural limits, security rules (like IP blocking/rate limits), and configuration requirements for **FormForge** deployed in `formforge-prod`.

---

## 1. Security & Access Control

### 🔒 Single-Owner Registration Limit
* **Constraint:** Only **one admin/owner user** can register.
* **Mechanism:** Once the first user completes the registration at `/dashboard`, the sign-up endpoint automatically locks down. Any subsequent registration attempts will fail with a `REGISTRATION_DISABLED` error.

### 🛡️ IP-Based Rate Limiting (IP Blocking)
* **Mechanism:** FormForge tracks the client's IP address (using Cloudflare headers `cf-connecting-ip` or `x-forwarded-for`) to limit abuse.
* **Current Rules:**
  * **Registration (`/api/auth/register`):** Allowed up to **30 attempts per 60 seconds** (preventing lockouts during slow database migrations/initial setup).
  * **Login (`/api/auth/login`):** Prevents brute-force attacks by limiting consecutive attempts per IP.
  * **Form Submissions (`/api/submit`):** Spam protection restricts how many times a single IP can submit forms within a specific timeframe.

---

## 2. Infrastructure & Database (Cloudflare D1)

### 📊 D1 Database Limitations
* **Storage Limit:** Since FormForge is designed to scale on Cloudflare's Free Tier, D1 databases are limited to Cloudflare’s free tier limits (typically **500MB** of database storage per database).
* **Read/Write Limits:** Cloudflare Free Plan allows up to **5 Million Reads** and **100,000 Writes** per day. If exceeded, the database will return query execution errors.

---

## 3. Integrations & Features

### 📧 Email Alerts (Resend.com or Custom SMTP)
* **Constraint:** Form submissions will **not** send email notifications unless configured with either:
  * **Global Resend:** Requires `RESEND_API_KEY` and `RESEND_FROM` set as environment variables.
  * **Custom SMTP:** Configured per-form on the dashboard settings. Enables support for **10+ email providers** including Gmail, Yahoo, Outlook/Hotmail, Resend SMTP, Mailjet, Brevo, SMTP2GO, SendGrid, Amazon SES, Mailgun, and Postmark.
* **🔒 AES-GCM Security Encryption:** SMTP passwords entered into the dashboard are securely encrypted in D1 using **AES-GCM (Web Crypto API)** and your `AUTH_SECRET` key, and masked in all client-side API requests.
* **⚡ Non-Blocking Background Sending:** Emails and Webhooks are sent asynchronously via Next.js `waitUntil` background execution context so that submissions remain instant (0.01s) without waiting for SMTP handshakes.

### 🤖 Proof of Work (Spam Protection)
* **Constraint:** When `require_proof_of_work` is enabled on a form, the client browser must solve a mathematical puzzle before submitting.
* **Impact:** This blocks headless automated spam bots, but might cause a slight delay (1-3 seconds) on extremely low-end mobile devices when submitting forms.

---

## 4. Benefit of `build-cf.js` (Wrapper Script)

The `build-cf.js` script was custom-created to act as an intelligent compile wrapper for Cloudflare Workers/Pages environment:

1. **Prevents Infinite Build Loops:**
   * Normally, setting `package.json` build command to OpenNext and wrangler's build command to `npm run build` triggers a circular loop where OpenNext calls the package manager build, which calls OpenNext again.
   * `build-cf.js` uses the environment variable `IN_OPEN_NEXT === 'true'` to detect the build phase. It runs standard `next build` if inside OpenNext, and `opennextjs-cloudflare build` if triggered by the outer deployment process, successfully breaking the cycle.
## 5. Added Features & Enhancements

The following custom features have been added to the production codebase:

### 📊 In-App Submissions Analytics
* **Dashboard Tab:** Accessible via the "Analytics" tab for each form.
* **Timeline Chart:** A scrollable HTML Bar Chart displaying the daily trend of accepted versus spam submissions over the last 30 days.
* **Aggregated Insights:** Detects and lists the **Top Referrer Sites** (which page the form was submitted from) and the **Top Submitter Emails** (most frequent users).

### 💬 Slack & Discord Auto-Webhook Formatting
* **Zero Configuration:** Simply input a standard Slack or Discord webhook URL into the "Webhook URL" field under Form Settings.
* **Auto-Formatting:** The notification handler automatically checks the URL pattern:
  * **Slack:** Formats submissions into beautiful Slack Blocks showing structured fields instead of raw JSON.
  * **Discord:** Formats submissions into rich Discord Embed fields with cyan borders and clear submitter metadata.

### 💻 Code Snippet Integration & Highlighting
* **Syntax Highlighting:** A custom lightweight CSS parser Highlights HTML, JavaScript, JSX, and Python syntax.
* **Available Snippets:** Includes copyable, live examples for:
  * **HTML Form** (with honeypot fields).
  * **JS Fetch API**.
  * **React Component** (with full state hooks).
  * **Python requests** script.

### ⏱️ Timezone & Creation Fixes
* **UTC Synchronization:** Fixes the timezone discrepancy where forms immediately displayed "Created 5 hours ago" due to the local client browser offset. Now displays local relative time correctly.

### 🛡️ Custom Spam Words Blocklist
* **Mechanism:** Add comma-separated keywords (e.g. `crypto`, `casino`, `viagra`) in the Form Settings.
* **Score Impact:** Any incoming submission containing any matching blocklisted words anywhere in the payload keys or values will have its spam score increased by `+100` and flagged as spam.

### 🤖 Cloudflare Turnstile Verification
* **Mechanism:** Integrate Turnstile keys in the form settings dashboard. Turnstile verification prevents bot spam without requiring users to solve frustrating puzzles.
* **Error Handling:** Failed token validations or missing headers during Turnstile validation will reject submissions.

### 🔑 API Key Expiration & Security
* **Expiry Options:** API keys can be set to expire after `30`, `90`, `365` days, or `Never`.
* **Mechanism:** The authentication middleware checks the `expiresAt` timestamp against current server time and rejects requests made using expired keys with `401 Unauthorized`.

### 📅 Automatic Data Retention Purging
* **Retention Options:** Forms can be configured to retain submissions for `30`, `60`, `90` days, or `Keep Forever` (default).
* **Purge execution:** The purge operation runs in the background of incoming form submissions, automatically executing a SQLite deletion command `DELETE FROM submissions WHERE form_id = ? AND created_at < threshold` to delete outdated logs. This keeps your D1 usage within the free-tier storage limits (500MB) without requiring external cron setups.

### ✉️ Submitter Email Verification (Double Opt-in)
* **Flow:** Enable in form settings. Submissions are temporarily held in `pending` status. A transactional email verification link is sent automatically to the submitter. Clicking the link changes status to `accepted` and triggers Slack/Discord webhooks or email notifications.

### 🔍 Smart DNS MX Lookup Validation
* **Email Safety:** Automatically resolves and validates the domain name of submitters' emails using Cloudflare DNS over HTTPS. If the domain doesn't contain active Mail Exchange (MX) records, the submission is rejected instantly as spam/invalid.

### 📥 Multi-Format Data Exports
* **Export Options:** Download submissions directly from the dashboard top-bar Action Dropdown as CSV, JSON (fully parsed nested objects), readable TXT reports, or styled PDF Print Layouts.

### ✏️ Editable Form Slugs & Hard Deletion
* **Dashboard Control:** Form endpoints can be dynamically renamed with custom URL slugs. Forms can be hard-deleted directly to immediately wipe database records.

