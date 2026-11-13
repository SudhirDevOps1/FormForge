# 🌩️ FormForge — Complete Cloudflare Environment & KV Setup Guide

This guide explains **every environment variable, encrypted secret, and Cloudflare binding** used by FormForge, exactly where to get them, and how to configure them in the **Cloudflare Dashboard** and local development.

---

## 📋 Quick Reference Table

| Name | Type | Required? | Where to Set in Cloudflare | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| **`DB`** | **D1 Database Binding** | **YES** | `Settings ➔ Bindings ➔ D1 database` | Primary SQLite database for users, forms, and submissions. |
| **`CACHE`** | **KV Namespace Binding** | Recommended | `Settings ➔ Bindings ➔ KV namespace` | Edge read-through cache for fast sub-5ms form lookups. (Auto-falls back to RAM if unbound). |
| **`AUTH_SECRET`** | **Encrypted Secret** | **YES** | `Settings ➔ Variables and Secrets ➔ Secret` | 64-char hex key used to sign and encrypt JWT session tokens and passwords. |
| **`APP_NAME`** | Plain Text Variable | Optional | `Settings ➔ Variables and Secrets ➔ Plaintext` | Brand name shown across emails and dashboard (Default: `FormForge`). |
| **`ALLOW_REGISTRATION`** | Plain Text Variable | Optional | `Settings ➔ Variables and Secrets ➔ Plaintext` | `"true"` or `"false"`. Set to `"false"` after creating your account to make it private. |
| **`RECOVERY_TOKEN`** | **Encrypted Secret** | Optional | `Settings ➔ Variables and Secrets ➔ Secret` | Operator emergency reset key for password recovery via CLI or recovery endpoint. |
| **`RESEND_API_KEY`** | **Encrypted Secret** | Optional | `Settings ➔ Variables and Secrets ➔ Secret` | API key from resend.com (100 free emails/day) for email notifications & magic links. |
| **`RESEND_FROM`** | Plain Text Variable | Optional | `Settings ➔ Variables and Secrets ➔ Plaintext` | Verified sender email in Resend (e.g. `forms@yourdomain.com`). |
| **`TELEGRAM_BOT_TOKEN`** | **Encrypted Secret** | Optional | `Settings ➔ Variables and Secrets ➔ Secret` | Bot token from `@BotFather` for 100% free unlimited instant push alerts. |
| **`TELEGRAM_CHAT_ID`** | Plain Text Variable | Optional | `Settings ➔ Variables and Secrets ➔ Plaintext` | Your numeric Telegram chat ID from `@userinfobot`. |
| **`GAS_URL`** | Plain Text Variable | Optional | `Settings ➔ Variables and Secrets ➔ Plaintext` | Google Apps Script Webhook URL for 1-click Google Sheets sync. |
| **`GAS_SECRET`** | **Encrypted Secret** | Optional | `Settings ➔ Variables and Secrets ➔ Secret` | Secret token matching your Google Apps Script for tamper protection. |

---

## 🚀 Two Setup Options

### Option 1: 1-Click Automated CLI Setup (Recommended)

If you have Node.js and the repository cloned locally:

1. **Auto-generate environment and secrets:**
   ```bash
   npm run setup:env
   ```
   *Generates a cryptographically secure 64-char `AUTH_SECRET`, writes `.env.local` for local development, and prints your dashboard credentials.*

2. **Auto-provision and bind Cloudflare KV Cache:**
   ```bash
   npm run setup:kv
   ```
   *Automatically checks or creates the `CACHE` namespace in Cloudflare and binds its ID in `wrangler.jsonc`.*

3. **Verify everything is properly configured:**
   ```bash
   npm run env:check
   ```

---

### Option 2: Cloudflare Dashboard Setup (For Git-based Deployments)

When deploying via **Cloudflare Workers Git Integration** (Workers Builds for Worker `apnaform`), configure these in the Cloudflare Dashboard:

```
Cloudflare Dashboard
  └── Compute (Workers & Pages)
        └── apnaform (Your Worker)
              └── Settings
                    ├── Bindings (D1 Database & KV Namespace)
                    └── Variables and Secrets (AUTH_SECRET & Integrations)
```

#### Step 1: Add D1 Database Binding (`DB`)
1. In Cloudflare Dashboard, go to **Workers & Pages** ➔ click your worker (e.g. **`apnaform`**).
2. Click the **Settings** tab ➔ select **Bindings**.
3. Click **Add binding** ➔ choose **D1 database**.
4. Set **Variable name** to: `DB` *(Must be uppercase `DB`)*.
5. In the **D1 database** dropdown, select your database (e.g. `formforge-db`).
   *(If you don't have one yet, click "Create database" and name it `formforge-db`).*
6. Click **Save and deploy**.

> [!IMPORTANT]
> **Data Loss Prevention:** If you previously had accounts and submissions in an existing D1 database, make sure you select that **same database** in the dropdown. Selecting a blank or new database will cause 401 login failures because your user record is in the old database.

---

#### Step 2: Add KV Namespace Binding (`CACHE`)
1. On the same **Bindings** page, click **Add binding** ➔ choose **KV namespace**.
2. Set **Variable name** to: `CACHE` *(Must be uppercase `CACHE`)*.
3. In the **KV namespace** dropdown, select `CACHE`.
   *(If you don't have one yet, click "Create namespace" and name it `CACHE`).*
4. Click **Save and deploy**.

> [!NOTE]
> FormForge includes automatic fail-soft caching: if the `CACHE` KV namespace is not yet bound, the application automatically uses per-isolate in-memory cache without throwing errors.

---

#### Step 3: Add Encrypted Secret (`AUTH_SECRET`)
1. Click the **Settings** tab ➔ select **Variables and Secrets**.
2. Click **+ Add** ➔ select **Secret**.
3. Set **Variable name** to: `AUTH_SECRET`.
4. Set **Value** to your 64-character hex key.
   *(Generate one locally by running `node scripts/setup-env.mjs --generate` or `openssl rand -hex 32`).*
5. Click **Save and deploy**.

---

#### Step 4: Add Public Variables (`APP_NAME`, `ALLOW_REGISTRATION`)
1. On the **Variables and Secrets** page, click **+ Add** ➔ select **Environment variable** (plain text).
2. Add:
   - **`APP_NAME`** = `FormForge`
   - **`ALLOW_REGISTRATION`** = `true` *(or `false` to prevent new signups once you're logged in)*
3. Click **Save and deploy**.

---

## 🛠️ Admin Account Recovery & Verification

If you ever see **"Email or password is incorrect"** or cannot log in:

1. **Check which users currently exist in your D1 database:**
   ```bash
   npm run auth:recover -- --check
   ```
   *Displays all registered email addresses, creation dates, and roles.*

2. **Reset the admin password instantly (Zero Data Loss):**
   ```bash
   npm run auth:recover -- --reset your-email@domain.com "YourNewSecurePassword123!"
   ```
   *Computes a fresh PBKDF2-SHA256 hash (100,000 iterations) and safely updates the user record directly in Cloudflare D1.*

3. **Provision a new owner account if database is blank:**
   ```bash
   npm run auth:recover -- --create admin@domain.com "YourStrongPassword123!" "Admin"
   ```

---

## 🔒 Security Best Practices

1. **Never commit `.env.local` or `.auth-secret-backup.txt` to Git.** Both are protected in `.gitignore`.
2. **Rotate `AUTH_SECRET` carefully:** If you change `AUTH_SECRET`, all existing user sessions will be invalidated and users will need to sign in again. Password hashes are salted independently and remain valid.
3. **Turn off open registration:** Once your administrator account is created, set `ALLOW_REGISTRATION=false` in Cloudflare dashboard to prevent unauthorized users from creating accounts on your private form engine.
