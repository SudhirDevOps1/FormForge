# 🛠️ FormForge - Custom App & Game Integration Guide

This guide explains how to connect custom applications, static games (like **Chor-Sipahi Game**), or headless frontend frameworks to your FormForge backend.

---

## 🔄 How it Works (Architecture Flow)

Below is the dynamic execution flow showing how your frontend game/app interacts with FormForge:

```mermaid
sequenceDiagram
    participant Player as 🎮 Game / App Frontend
    participant FF as ⚡ FormForge (Cloudflare Workers)
    participant DB as 📀 Cloudflare D1 Database
    participant Hook as 💬 Discord / Slack Webhooks

    Player->>FF: 1. POST Submission (JSON payload / FormData)
    Note over FF: 2. Security Check (CORS, Turnstile, Rate Limit, Spam Blocklist)
    alt Validation Failed
        FF-->>Player: 3a. Return 400 Bad Request / 429 Rate Limited
    else Validation Passed
        FF->>DB: 3b. Store Record (User submission data)
        FF->>Hook: 3c. Send background notify alerts (waitUntil context)
        FF-->>Player: 3d. Return 200 OK {"ok": true, "submissionId": "..."}
    end
```

---

## 🌍 1. Crucial Pre-requisite: CORS (Cross-Origin Resource Sharing)

If your app or game is hosted on a domain like `https://chor-sipahi-game.sudhirdevops1.workers.dev` and your FormForge backend is on `https://apnaform.sudhirdevops1.workers.dev`, **browsers will block the request** unless you allow CORS.

### 🛠️ How to Enable CORS for Your App:
1. Log in to your **FormForge Dashboard** (`/dashboard`).
2. Select your form and click the **Settings** tab.
3. Locate the **Allowed Origins** field:
   * **To Allow Everything (Development):** Set it to `*`.
   * **To Secure in Production:** Set it to your exact domain, e.g., `https://chor-sipahi-game.sudhirdevops1.workers.dev`.
4. Click **Save Settings**.

---

## 💻 2. Integration Snippets

### Option A: Modern JavaScript `fetch` (Best for games & dynamic scripts)
Use this within your game logic (e.g., when a player wins, loses, or finishes a round of Chor-Sipahi) to store game statistics.

```javascript
// Function to upload game results to FormForge
async function saveGameResult(playerName, score, role, roundsPlayed) {
  const url = "https://apnaform.sudhirdevops1.workers.dev/api/submit/YOUR_ENDPOINT_ID";
  
  const payload = {
    player_name: playerName,
    final_score: score,
    assigned_role: role, // e.g., Raja, Mantri, Chor, Sipahi
    rounds: roundsPlayed,
    submitted_via: "Chor-Sipahi Web Game v1.0"
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok && data.ok) {
      console.log("🎉 Stats stored! Submission ID:", data.submissionId);
    } else {
      console.error("❌ Submission rejected by FormForge:", data.message);
    }
  } catch (error) {
    console.error("🌐 Network/CORS Error:", error);
  }
}
```

### Option B: HTML5 Multipart Form (Best for Contact/File uploads)
Use this if you are collecting user feedback, bug reports, or attachments (such as screenshots) from your game.

```html
<form 
  method="POST" 
  action="https://apnaform.sudhirdevops1.workers.dev/api/submit/YOUR_ENDPOINT_ID"
  enctype="multipart/form-data"
  style="font-family: sans-serif; max-width: 400px; display: flex; flex-direction: column; gap: 12px;"
>
  <label>Your Name</label>
  <input name="name" type="text" required placeholder="Enter name" />

  <label>Email Address</label>
  <input name="email" type="email" required placeholder="name@domain.com" />

  <label>Game Bug Screenshot / Log File</label>
  <!-- NOTE: File input requires enctype="multipart/form-data" on the <form> element -->
  <input name="screenshot" type="file" required />

  <!-- Honeypot field (hidden from users, traps automated bots) -->
  <input name="website" tabindex="-1" autocomplete="off" style="display:none;" />

  <button type="submit">Submit Report</button>
</form>
```

---

## ⚠️ 3. Troubleshooting Integration Failures

### 1. `Response to preflight request doesn't pass access control check`
* **Fix:** The Origin header of your request doesn't match the `Allowed Origins` in your Form settings. Go to FormForge settings and add `https://chor-sipahi-game.sudhirdevops1.workers.dev` to the origin list.

### 2. Form submits, but fields are empty in the Dashboard
* **Fix:** If sending raw JSON, ensure headers have `"Content-Type": "application/json"`. If sending HTML form, make sure all inputs have unique `name="..."` tags.

### 3. Verification Link displays raw HTML instead of CSS styling
* **Fix:** The mail client is loading text fallback. FormForge v1.2.0 uses inline-table layouts optimized for all clients. Update to v1.2.0.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)  
> © 2024-2026 Sudhir Singh. All rights reserved.
