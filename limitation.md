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

### 📧 Email Alerts (Resend.com Dependency)
* **Constraint:** Form submissions will **not** send email notifications unless you provide:
  * `RESEND_API_KEY` (Secret variable in Cloudflare)
  * `RESEND_FROM` (Verified sender email domain in Resend)
* **Free Tier Limit:** Resend's free tier allows up to **3,000 emails per month** (100 emails per day).

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
