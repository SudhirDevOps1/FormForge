/**
 * FormForge Universal OTP Verification Embed
 * Drop this script onto ANY website or portfolio to enable seamless 6-digit email verification.
 * Usage:
 *   <script src="https://your-domain/otp.js" defer></script>
 */
(function () {
  if (typeof window === "undefined" || window.__formforge_otp_loaded) return;
  window.__formforge_otp_loaded = true;

  var currentForm = null;
  var currentEmail = "";
  var currentEndpoint = "";
  var verifiedSessions = {};

  // Inject styles
  var style = document.createElement("style");
  style.id = "formforge-otp-styles";
  style.textContent = `
    .ff-otp-overlay {
      position: fixed;
      inset: 0;
      background: rgba(3, 7, 18, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .ff-otp-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }
    .ff-otp-modal {
      width: 100%;
      max-width: 440px;
      background: #0b0f19;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 28px 24px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(14, 165, 233, 0.15);
      color: #f8fafc;
      text-align: center;
      transform: scale(0.95);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ff-otp-overlay.active .ff-otp-modal {
      transform: scale(1);
    }
    .ff-otp-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 18px;
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(14, 165, 233, 0.3);
      color: #38bdf8;
      font-size: 24px;
      margin-bottom: 16px;
    }
    .ff-otp-title {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
    }
    .ff-otp-desc {
      font-size: 13px;
      color: #94a3b8;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }
    .ff-otp-email-badge {
      color: #38bdf8;
      font-weight: 600;
      word-break: break-all;
    }
    .ff-otp-input-group {
      margin-bottom: 20px;
    }
    .ff-otp-input {
      width: 100%;
      background: #030712;
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 14px;
      font-size: 28px;
      font-weight: 800;
      font-family: monospace;
      letter-spacing: 12px;
      text-align: center;
      color: #38bdf8;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      box-sizing: border-box;
    }
    .ff-otp-input:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.25);
    }
    .ff-otp-error {
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fda4af;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 12px;
      margin-bottom: 16px;
      display: none;
    }
    .ff-otp-submit-btn {
      width: 100%;
      padding: 14px 20px;
      border-radius: 16px;
      border: none;
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.15s ease, filter 0.15s ease;
      box-shadow: 0 10px 20px -5px rgba(2, 132, 199, 0.4);
    }
    .ff-otp-submit-btn:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    .ff-otp-submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .ff-otp-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 20px;
      font-size: 12px;
      color: #64748b;
    }
    .ff-otp-resend {
      background: none;
      border: none;
      color: #38bdf8;
      cursor: pointer;
      font-size: 12px;
      padding: 4px;
      text-decoration: underline;
    }
    .ff-otp-close {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 12px;
      padding: 4px;
    }
    .ff-otp-close:hover {
      color: #ffffff;
    }
  `;
  document.head.appendChild(style);

  // Inject modal markup
  var overlay = document.createElement("div");
  overlay.className = "ff-otp-overlay";
  overlay.id = "ff-otp-overlay";
  overlay.innerHTML = `
    <div class="ff-otp-modal" role="dialog" aria-modal="true" aria-labelledby="ff-otp-title">
      <div class="ff-otp-icon">🔐</div>
      <h3 class="ff-otp-title" id="ff-otp-title">Verify Your Email</h3>
      <p class="ff-otp-desc">
        We sent a 6-digit verification code to<br/>
        <span class="ff-otp-email-badge" id="ff-otp-email-display"></span>
      </p>

      <div class="ff-otp-error" id="ff-otp-error"></div>

      <div class="ff-otp-input-group">
        <input type="text" id="ff-otp-input" class="ff-otp-input" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="••••••" autocomplete="one-time-code" />
      </div>

      <button type="button" id="ff-otp-submit" class="ff-otp-submit-btn">Verify & Submit Form ✓</button>

      <div class="ff-otp-footer">
        <button type="button" id="ff-otp-resend" class="ff-otp-resend">Resend Code</button>
        <button type="button" id="ff-otp-close" class="ff-otp-close">✕ Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  var input = document.getElementById("ff-otp-input");
  var submitBtn = document.getElementById("ff-otp-submit");
  var resendBtn = document.getElementById("ff-otp-resend");
  var closeBtn = document.getElementById("ff-otp-close");
  var errorBox = document.getElementById("ff-otp-error");
  var emailDisplay = document.getElementById("ff-otp-email-display");

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = msg ? "block" : "none";
    }
  }

  function closeModal() {
    overlay.classList.remove("active");
    showError("");
    if (input) input.value = "";
  }

  function openModal(email, endpoint) {
    currentEmail = email;
    currentEndpoint = endpoint;
    if (emailDisplay) emailDisplay.textContent = email;
    showError("");
    if (input) {
      input.value = "";
      setTimeout(function () { input.focus(); }, 150);
    }
    overlay.classList.add("active");
    requestOtpCode();
  }

  async function requestOtpCode() {
    if (!currentEmail || !currentEndpoint) return;
    try {
      showError("");
      var res = await fetch(currentEndpoint + "/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentEmail }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showError(data.message || "Failed to send verification code. Please try again.");
      }
    } catch (e) {
      showError("Network error while sending code. Please check connection.");
    }
  }

  async function verifyOtpAndProceed() {
    var code = (input && input.value.trim()) || "";
    if (code.length !== 6) {
      showError("Please enter the complete 6-digit code.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Verifying…";
    showError("");

    try {
      var res = await fetch(currentEndpoint + "/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentEmail, code: code }),
      });
      var data = await res.json().catch(function () { return {}; });

      if (res.ok && data.ok) {
        verifiedSessions[currentEmail] = code;
        closeModal();

        // Inject OTP into currentForm and submit
        if (currentForm) {
          var hiddenOtp = currentForm.querySelector("input[name='_ff_otp'], input[name='otp']");
          if (!hiddenOtp) {
            hiddenOtp = document.createElement("input");
            hiddenOtp.type = "hidden";
            hiddenOtp.name = "_ff_otp";
            currentForm.appendChild(hiddenOtp);
          }
          hiddenOtp.value = code;

          // Dispatch native submit
          if (typeof currentForm.requestSubmit === "function") {
            currentForm.requestSubmit();
          } else {
            currentForm.submit();
          }
        }
      } else {
        showError(data.message || "Incorrect code. Please check your email and try again.");
      }
    } catch (e) {
      showError("Failed to verify code. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Verify & Submit Form ✓";
    }
  }

  if (submitBtn) submitBtn.addEventListener("click", verifyOtpAndProceed);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (resendBtn) resendBtn.addEventListener("click", requestOtpCode);
  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        verifyOtpAndProceed();
      }
    });
  }

  // Intercept any form submitting to FormForge
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;

    var action = form.getAttribute("action") || "";
    if (!action.includes("/api/submit/")) return;

    // Extract endpoint
    var match = action.match(/\/api\/submit\/([a-zA-Z0-9_-]+)/);
    if (!match) return;

    // Find email field
    var emailInput = form.querySelector("input[type='email'], input[name='email'], input[name='Email']");
    var emailVal = emailInput ? emailInput.value.trim() : "";

    if (!emailVal || !emailVal.includes("@")) {
      return; // let native validation handle email
    }

    // Check if already verified
    var existingOtp = form.querySelector("input[name='_ff_otp'], input[name='otp']");
    if (existingOtp && existingOtp.value && existingOtp.value.length === 6) {
      return; // Already has verified code, proceed with submit
    }

    if (verifiedSessions[emailVal]) {
      if (!existingOtp) {
        existingOtp = document.createElement("input");
        existingOtp.type = "hidden";
        existingOtp.name = "_ff_otp";
        form.appendChild(existingOtp);
      }
      existingOtp.value = verifiedSessions[emailVal];
      return; // verified, proceed
    }

    // Intercept submit and show OTP modal!
    e.preventDefault();
    e.stopPropagation();
    currentForm = form;

    var endpointBase = action.split("/api/submit/")[0] + "/api/submit/" + match[1];
    openModal(emailVal, endpointBase);
  }, true);

})();
