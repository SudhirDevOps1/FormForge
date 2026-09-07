/**
 * FormForge Floating Feedback & Contact Widget
 * Zero-dependency, ultra-lightweight (<3KB), cardless free-tier compatible.
 * Usage:
 *   <script src="https://your-domain.pages.dev/widget.js"
 *           data-endpoint="https://your-domain.pages.dev/f/FORM_ID"
 *           data-position="bottom-right"
 *           data-color="#0ea5e9"
 *           data-title="Send us feedback"
 *           data-btn-text="Feedback"
 *           defer></script>
 */
(function () {
  if (typeof window === "undefined" || document.getElementById("formforge-widget-root")) return;

  var currentScript = document.currentScript || document.querySelector("script[data-endpoint]");
  var endpoint = currentScript ? currentScript.getAttribute("data-endpoint") : "";
  if (!endpoint) return;

  var position = (currentScript && currentScript.getAttribute("data-position")) || "bottom-right";
  var btnText = (currentScript && currentScript.getAttribute("data-btn-text")) || "Feedback";
  var title = (currentScript && currentScript.getAttribute("data-title")) || "Send us a message";
  var themeColor = (currentScript && currentScript.getAttribute("data-color")) || "#0ea5e9";

  var style = document.createElement("style");
  style.id = "formforge-widget-styles";
  style.textContent = `
    .ff-w-btn {
      position: fixed;
      ${position === "bottom-left" ? "left: 20px;" : "right: 20px;"}
      bottom: 20px;
      z-index: 999990;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 18px;
      border-radius: 9999px;
      background: ${themeColor};
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      border: none;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ff-w-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(0,0,0,0.4);
      filter: brightness(1.1);
    }
    .ff-w-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 999991;
      display: flex;
      align-items: flex-end;
      justify-content: ${position === "bottom-left" ? "flex-start" : "flex-end"};
      padding: 24px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .ff-w-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .ff-w-modal {
      width: 100%;
      max-width: 420px;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      transform: translateY(20px) scale(0.96);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ff-w-overlay.open .ff-w-modal {
      transform: translateY(0) scale(1);
    }
    .ff-w-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);
    }
    .ff-w-title {
      font-size: 15px;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ff-w-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 22px;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      line-height: 1;
    }
    .ff-w-close:hover { color: #ffffff; background: rgba(255,255,255,0.08); }
    .ff-w-body { padding: 20px; }
    .ff-w-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .ff-w-input, .ff-w-textarea {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      color: #ffffff;
      margin-bottom: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .ff-w-input:focus, .ff-w-textarea:focus {
      border-color: ${themeColor};
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.25);
    }
    .ff-w-textarea { resize: vertical; min-height: 90px; }
    .ff-w-submit {
      width: 100%;
      padding: 12px;
      background: ${themeColor};
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.2s;
    }
    .ff-w-submit:hover { filter: brightness(1.1); }
    .ff-w-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .ff-w-honeypot { display: none !important; }
    .ff-w-success {
      text-align: center;
      padding: 30px 10px;
    }
    .ff-w-success-icon {
      width: 48px;
      height: 48px;
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
      font-size: 24px;
    }
    .ff-w-badge {
      text-align: center;
      font-size: 10px;
      color: #64748b;
      margin-top: 14px;
    }
  `;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.id = "formforge-widget-root";

  var btn = document.createElement("button");
  btn.className = "ff-w-btn";
  btn.setAttribute("aria-label", title);
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
    <span>${btnText}</span>
  `;

  var overlay = document.createElement("div");
  overlay.className = "ff-w-overlay";
  overlay.innerHTML = `
    <div class="ff-w-modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="ff-w-header">
        <h3 class="ff-w-title">
          <span>💬</span>
          <span>${title}</span>
        </h3>
        <button class="ff-w-close" aria-label="Close">&times;</button>
      </div>
      <div class="ff-w-body" id="ff-w-body-content">
        <form id="ff-w-form">
          <input type="text" name="_gotcha" class="ff-w-honeypot" tabindex="-1" autocomplete="off" />
          <label class="ff-w-label">Your Name</label>
          <input type="text" name="name" class="ff-w-input" placeholder="Alex Smith" required />
          <label class="ff-w-label">Your Email</label>
          <input type="email" name="email" class="ff-w-input" placeholder="alex@example.com" required />
          <label class="ff-w-label">Message</label>
          <textarea name="message" class="ff-w-textarea" placeholder="How can we help?" required></textarea>
          <button type="submit" class="ff-w-submit" id="ff-w-btn-submit">Send Message</button>
          <div class="ff-w-badge">⚡ Powered by FormForge • Free Tier Backend</div>
        </form>
      </div>
    </div>
  `;

  root.appendChild(btn);
  root.appendChild(overlay);
  document.body.appendChild(root);

  function toggleModal(open) {
    if (open) {
      overlay.classList.add("open");
      var firstInput = overlay.querySelector("input:not([tabindex='-1'])");
      if (firstInput) firstInput.focus();
    } else {
      overlay.classList.remove("open");
    }
  }

  btn.addEventListener("click", function () { toggleModal(true); });
  overlay.querySelector(".ff-w-close").addEventListener("click", function () { toggleModal(false); });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) toggleModal(false);
  });

  var formEl = overlay.querySelector("#ff-w-form");
  formEl.addEventListener("submit", async function (e) {
    e.preventDefault();
    var submitBtn = overlay.querySelector("#ff-w-btn-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    var formData = new FormData(formEl);
    try {
      var res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData,
      });
      var data = await res.json();
      if (res.ok && data.ok) {
        overlay.querySelector("#ff-w-body-content").innerHTML = `
          <div class="ff-w-success">
            <div class="ff-w-success-icon">✓</div>
            <h4 style="font-size: 16px; font-weight: 700; margin: 0 0 6px;">Message Sent!</h4>
            <p style="font-size: 13px; color: #94a3b8; margin: 0 0 20px;">Thank you for contacting us. We will get back to you shortly.</p>
            <button class="ff-w-submit" id="ff-w-btn-done">Done</button>
          </div>
        `;
        var doneBtn = overlay.querySelector("#ff-w-btn-done");
        if (doneBtn) doneBtn.addEventListener("click", function () { toggleModal(false); });
      } else {
        alert(data.message || "Failed to send message. Please try again.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    } catch {
      alert("Network error occurred. Please check your internet connection.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
  });
})();
