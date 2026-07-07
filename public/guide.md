# 📖 FormForge — Complete Deployment Guide (Hinglish)

> **FormForge** ek completely free, open-source, privacy-first form backend hai jo Cloudflare Workers + D1 par chalta hai. Koi paid database nahi, koi subscription nahi. Sab Cloudflare ke free tier mein fit hota hai.

---

## 📋 Kya Chahiye? (Prerequisites)

| Cheez | Kahan se milega | Free hai? |
|-------|-----------------|-----------|
| **GitHub account** | [github.com](https://github.com) par signup karo | ✅ Completely free |
| **Cloudflare account** | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) par signup karo | ✅ Free, **NO credit card** required |
| **Terminal** (manual deploy ke liye) | Mac: Terminal, Windows: PowerShell ya CMD | ✅ Already installed |
| **Node.js 18+** (manual deploy ke liye) | [nodejs.org](https://nodejs.org) | ✅ Free |

> ⚠️ **One-click deploy ke liye** sirf GitHub + Cloudflare account chahiye. Terminal ki zarurat nahi!

---

## 🚀 Method 1: One-Click Deploy (Recommended)

**Ye sabse easy method hai. 3 minute mein live ho jayega.**

### Step 1: Deploy Button Click Karo

👉 [**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge)

### Step 2: Cloudflare mein Sign In

- Cloudflare apna login page dikhayega
- **Apna** Cloudflare account use karo (ya naya banao)
- ❗ Ye **tumhare** account mein deploy hoga, kisi aur ke nahi

### Step 3: GitHub Authorize

- Cloudflare tumse GitHub access mangega
- "Authorize" karo — ye tumhare GitHub mein ek copy repository banayega

### Step 4: Configuration Fill Karo

Cloudflare ye details mangega:

| Field | Kya dalna hai | Example |
|-------|---------------|---------|
| **Project name** | Kuch bhi name do Worker ko | `formforge` ya `my-forms` |
| **Database name** | D1 database ka name | `formforge-db` |
| **AUTH_SECRET** | Ek lambi random string | Terminal mein: `openssl rand -hex 32` ya [jwtsecrets.com](https://jwtsecrets.com) se copy karo |
| **RESEND_API_KEY** | Email chahiye to dalo, nahi to **blank chhodo** | Blank = email off |
| **RESEND_FROM** | Email sender address | Blank = email off |

### AUTH_SECRET Kaise Generate Karein?

**Option A:** Terminal mein ye run karo:
```bash
openssl rand -hex 32
```
Output aayega kuch aisa: `a3f4b2c8d9e1f0a5b7c3d6e8f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8`

**Option B:** [jwtsecrets.com](https://jwtsecrets.com) kholo, "Generate" click karo, copy karo.

**Option C:** Koi bhi long random string daal do (minimum 32 characters)

### Step 5: Deploy!

- "Deploy" click karo
- 2-3 minute mein build + deploy ho jayega
- Cloudflare automatically D1 database create karega
- FormForge automatically tables create karega first request par

### Step 6: Dashboard Open Karo

Deploy hone ke baad tumhe URL milega jaise:
```
https://formforge.YOUR-SUBDOMAIN.workers.dev
```

Is URL ke baad `/dashboard` lagao:
```
https://formforge.YOUR-SUBDOMAIN.workers.dev/dashboard
```

### Step 7: Account Banao

- Dashboard par "Create your account" form dikhega
- Email, name, password dalo (password minimum 10 characters)
- "Create account" click karo
- Ab tum logged in ho! 🎉

### Step 8: Form Banao

- "+ New" click karo
- Form name do (e.g. "Contact Form")
- "Create" click karo
- Endpoint URL copy karo — ye tumhara form backend URL hai

### Step 9: Apni Website mein Use Karo

Dashboard mein "Copy HTML" ya "Copy JS fetch" click karo. Example:

```html
<form method="POST" action="https://formforge.YOUR-SUBDOMAIN.workers.dev/api/submit/endpoint_xxxxx">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <!-- Honeypot (hidden spam trap - ye hidden hi rehne do) -->
  <input name="website" tabindex="-1" autocomplete="off" style="display:none" />
  <button type="submit">Send</button>
</form>
```

**Bas! Ab koi bhi is form se submit karega to submission tumhare D1 database mein save hogi.** Dashboard par dikhegi.

---

## 🔧 Method 2: Manual Deploy (Advanced)

### Step 1: Clone + Install

```bash
git clone https://github.com/SudhirDevOps1/FormForge.git
cd FormForge
npm install
```

### Step 2: Wrangler Login

```bash
npx wrangler login
```
Browser khulega → Cloudflare account se login karo.

### Step 3: D1 Database Create (Optional)

```bash
npx wrangler d1 create formforge-db
```

Output mein `database_id` aayega. Ise `wrangler.jsonc` mein paste karo:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "formforge-db",
    "database_id": "PASTE-YOUR-ID-HERE"
  }
]
```

> 💡 Agar `database_id` blank chhodo to Cloudflare deploy time par auto-create karega.

### Step 4: Secrets Set Karo

```bash
npx wrangler secret put AUTH_SECRET
# Prompt aayega, wahan apna secret paste karo
```

### Step 5: Deploy

```bash
npm run deploy
```

Ye internally:
1. `opennextjs-cloudflare build` (Next.js → Workers build)
2. D1 migrations apply (optional, skip hone par bhi chalega)
3. `opennextjs-cloudflare deploy` (Cloudflare par deploy)

---

## 🌍 Environment Variables — Kya Hai, Kahan Milega

### AUTH_SECRET (Required)

**Kya hai:** Session tokens aur API keys ko hash karne ke liye secret key.

**Kahan se laye:**
- `openssl rand -hex 32` (terminal)
- [jwtsecrets.com](https://jwtsecrets.com)
- Koi bhi random 32+ character string

**Kahan dalna hai:**
- **One-click deploy:** Cloudflare deploy wizard mein field dikhega
- **Manual deploy:** `npx wrangler secret put AUTH_SECRET`
- **Cloudflare Dashboard:** Workers → Your Worker → Settings → Variables → Add Secret

### RESEND_API_KEY (Optional)

**Kya hai:** Email notification bhejne ke liye Resend.com ka API key.

**Kahan se laye:**
1. [resend.com](https://resend.com) par free account banao
2. Dashboard → API Keys → Create API Key
3. Key copy karo

**Agar nahi chahiye:** Blank chhod do. Email notifications automatically disable ho jayengi.

### RESEND_FROM (Optional)

**Kya hai:** Email ka sender address.

**Example:** `FormForge <forms@example.com>`

**Agar nahi chahiye:** Blank chhod do.

### DB (Binding — Secret Nahi)

**Kya hai:** Cloudflare D1 database ka binding name. Ye **secret nahi hai**, ye `wrangler.jsonc` mein configure hota hai.

**Kahan hai:** Already `wrangler.jsonc` mein set hai:
```jsonc
"d1_databases": [{ "binding": "DB", "database_name": "formforge-db" }]
```

> ❌ `DATABASE_URL` mat dalo. FormForge PostgreSQL use nahi karta.

---

## 📊 Dashboard Kaise Use Karein

### Forms Tab
- **+ New** — Naya form banao
- **Search** — Forms search karo
- Form select karo → submissions dikhenge
- **Settings** tab se form ka name, webhook, allowed origins edit karo
- **⬇ CSV** — Saari submissions download karo

### API Keys Tab
- API keys banao (read-only tokens)
- Key sirf ek baar dikhegi — turant copy karo!
- API keys se programmatically submissions read kar sakte ho

### Settings Tab
- Account details dekho
- Quick links: Docs, Guide, GitHub, Health Check

---

## 🔒 Privacy — Tumhara Data Safe Hai

| Feature | Detail |
|---------|--------|
| **Data location** | Tumhare Cloudflare account ke D1 mein |
| **IP address** | SHA-256 hash karke store hota hai, plain IP nahi |
| **Passwords** | PBKDF2-SHA256, 210K iterations |
| **Session tokens** | HMAC-SHA256 hash karke store |
| **Analytics** | Koi third-party tracker nahi |
| **Email** | Optional, off by default |
| **Webhook** | Optional, off by default |

---

## 🐛 Common Problems & Solutions

### Error: `DATABASE_URL is required`
**Ye FormForge mein nahi aana chahiye!** Agar aata hai to purana code chal raha hai. Latest version use karo.

### Error: `D1_NOT_CONFIGURED`
D1 binding set nahi hai. Check karo:
- `wrangler.jsonc` mein `d1_databases` section hai
- Binding name `DB` hai
- Cloudflare Dashboard mein Worker → Settings → Bindings mein D1 dikh raha hai

### Dashboard par "Network error"
- Worker deployed hai ya nahi check karo
- D1 database connected hai ya nahi check karo
- `AUTH_SECRET` set hai ya nahi check karo

### Password "at least 10 characters"
- Minimum 10 character ka password dalo
- Example: `MySecure123`

### Email notifications nahi aa rahi
- `RESEND_API_KEY` set karo Cloudflare secrets mein
- `RESEND_FROM` bhi set karo
- Form settings mein "Enable email notifications" ON karo
- Form settings mein email address dalo

---

## 💰 Cloudflare Free Tier Limits

| Resource | Free Limit | Kaafi hai? |
|----------|-----------|-----------|
| **Workers requests** | 100,000/day | ✅ Small-medium sites ke liye |
| **D1 reads** | 5 million/day | ✅ Bahut zyada |
| **D1 writes** | 100,000/day | ✅ 100K submissions/day |
| **D1 storage** | 5 GB | ✅ Millions of submissions |
| **Workers script size** | 10 MB compressed | ✅ FormForge fit hai |

> 🎉 99% users ko paid plan ki zarurat nahi padegi!

---

## 🔄 Update Kaise Karein

Naya version aaye to:

1. Cloudflare Dashboard mein current Worker rename karo: `formforge-backup`
2. GitHub pe purani fork repository delete karo
3. Dobara [Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge) click karo
4. **Same database name** use karo → existing data preserved!
5. Naya `AUTH_SECRET` dalo → dobara login karna hoga lekin data safe hai
6. Confirm karke backup Worker delete karo

---

## 🛠 Tech Stack

| Technology | Role | Free? |
|-----------|------|-------|
| **Next.js 16** | App framework | ✅ MIT |
| **React 19** | UI library | ✅ MIT |
| **Cloudflare Workers** | Runtime | ✅ Free tier |
| **Cloudflare D1** | Database (SQLite) | ✅ Free tier |
| **OpenNext** | CF Workers adapter | ✅ MIT |
| **Drizzle ORM** | Database ORM | ✅ MIT |
| **Tailwind CSS** | Styling | ✅ MIT |
| **Wrangler** | CLI deploy tool | ✅ MIT |

**Total cost: ₹0 / $0** 🎉

---

## ❓ FAQ

**Q: Kya mujhe credit card chahiye?**
A: Nahi! Cloudflare free tier mein credit card nahi mangta.

**Q: Kya ye meri website slow karegi?**
A: Nahi. FormForge Cloudflare ke global edge network par chalta hai — response time <50ms globally.

**Q: Kya data kisi aur ko dikhega?**
A: Nahi. Data tumhare Cloudflare D1 mein hai. Sirf tumhare account se accessible hai.

**Q: Kya multiple websites se use kar sakte hain?**
A: Haan! Unlimited forms banao, har website ke liye alag form.

**Q: PostgreSQL ya Neon/Supabase chahiye?**
A: **Nahi!** FormForge D1 (SQLite) use karta hai jo Cloudflare mein built-in hai. Koi external database nahi chahiye.

**Q: Custom domain use kar sakte hain?**
A: Haan! Cloudflare Dashboard → Worker → Custom Domains → apna domain add karo.

---

## 📞 Support

- **Issues:** [github.com/SudhirDevOps1/FormForge/issues](https://github.com/SudhirDevOps1/FormForge/issues)
- **Docs:** `/docs.html` (English)
- **Guide:** `/guide.html` (Hinglish — ye file)

---

*FormForge — Apna form backend, apne Cloudflare account mein, zero cost, zero vendor lock-in.* 🔥
