import { eq } from "drizzle-orm";
import { getRuntimeEnv, type AppDb } from "@/db";
import { notifications, users, webhookLogs, type Form, type Submission } from "@/db/schema";
import { randomId } from "./crypto";
import nodemailer from "nodemailer";

function extractGasSecret(gasUrl?: string | null, envSecret?: string): string | undefined {
  if (envSecret && envSecret.trim()) return envSecret.trim();
  try {
    const env = getRuntimeEnv();
    const globalEnvSecret = (env.GAS_SECRET || env.GAS_SECRET_TOKEN || (process.env.GAS_SECRET as string) || (process.env.GAS_SECRET_TOKEN as string))?.trim();
    if (globalEnvSecret) return globalEnvSecret;
  } catch {
    // fallback
  }

  if (!gasUrl) return undefined;
  try {
    const u = new URL(gasUrl);
    return u.searchParams.get("secret") || u.searchParams.get("token") || undefined;
  } catch {
    return undefined;
  }
}

async function sendSmtpEmail(
  host: string,
  port: number,
  user: string,
  pass: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  html?: string,
  replyTo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // secure:true for 465, false for 587
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      replyTo,
    });
    return { success: !!info.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function getSmtpConfig(form: Form, env: Record<string, string | undefined>, ownerUser?: typeof users.$inferSelect) {
  const enabled = form.smtpEnabled || ownerUser?.globalSmtpEnabled || (env.SMTP_ENABLED === "true" || env.SMTP_ENABLED === "1");
  const host = (form.smtpEnabled && form.smtpHost) || ownerUser?.globalSmtpHost || env.SMTP_HOST;
  const port = (form.smtpEnabled && form.smtpPort) ? Number(form.smtpPort) : (ownerUser?.globalSmtpPort ? Number(ownerUser.globalSmtpPort) : (env.SMTP_PORT ? Number(env.SMTP_PORT) : 587));
  const user = (form.smtpEnabled && form.smtpUser) || ownerUser?.globalSmtpUser || env.SMTP_USER;
  const from = (form.smtpEnabled && form.smtpFrom) || ownerUser?.globalSmtpFrom || env.SMTP_FROM;
  
  const hasDbPass = (form.smtpEnabled && !!form.smtpPass) || (!form.smtpEnabled && !!ownerUser?.globalSmtpPass);
  const dbPass = (form.smtpEnabled ? form.smtpPass : ownerUser?.globalSmtpPass) || undefined;

  return {
    enabled: !!(enabled && host && port && user && from),
    host,
    port,
    user,
    from,
    hasDbPass,
    dbPass,
    envPass: env.SMTP_PASS,
  };
}

type DeliveryResult = {
  channel: "email" | "webhook" | "gas" | "telegram" | "ntfy";
  status: "sent" | "skipped" | "failed";
  error?: string;
};

async function recordNotification(db: AppDb, formId: string, submissionId: string, result: DeliveryResult) {
  if (result.status === "skipped") {
    return;
  }

  await db.insert(notifications).values({
    formId,
    submissionId,
    channel: result.channel,
    status: result.status,
    error: result.error,
  });
}

export async function deliverNotifications(db: AppDb, form: Form, submission: Submission, appUrl?: string): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  const env = getRuntimeEnv();
  const payload = JSON.parse(submission.payload) as Record<string, unknown>;
  const dashboardUrl = appUrl ? `${appUrl}/dashboard` : (env.APP_URL ? `${env.APP_URL}/dashboard` : "/dashboard");

  let ownerUser: typeof users.$inferSelect | undefined;
  if (form.userId) {
    try {
      const ownerRows = await db.select().from(users).where(eq(users.id, form.userId)).limit(1);
      ownerUser = ownerRows[0];
    } catch {
      // Ignore error
    }
  }

  let targetEmail = form.emailTo || ownerUser?.email;
  const shouldNotifyEmail = (form.notifyEmail || (ownerUser?.globalSmtpEnabled && ownerUser?.notifyOnSubmission !== false)) && !!targetEmail;

  const tableRows = Object.entries(payload)
    .map(([k, v]) => `
      <tr>
        <td style="padding: 12px 15px; border-bottom: 1px solid #1E293B; font-weight: 600; color: #FFFFFF; font-size: 14px; width: 30%;">${k}</td>
        <td style="padding: 12px 15px; border-bottom: 1px solid #1E293B; color: #9CA3AF; font-size: 14px; word-break: break-all;">${String(v)}</td>
      </tr>
    `).join("");

  const text = `FormForge received a new submission for ${form.name}.\n\n${JSON.stringify(payload, null, 2)}`;
  let subject = form.emailSubjectTemplate || `📩 New submission for ${form.name}`;
  subject = subject.replace(/\{form_name\}/g, form.name);
  subject = subject.replace(/\{name\}/g, (payload.name as string) || (payload.fullName as string) || form.name);
  subject = subject.replace(/\{email\}/g, (submission.email || (payload.email as string)) || "");
  Object.entries(payload).forEach(([k, v]) => {
    subject = subject.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  });

  const html = `
<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0B0F19; color: #F1F5F9; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1E293B;">
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 24px; font-weight: 800; color: #0EA5E9; letter-spacing: -0.05em; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
      <span style="background: linear-gradient(135deg, #0EA5E9, #2563EB); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: sans-serif;">FormForge</span>
    </div>
  </div>
  <div style="background-color: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 30px; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
    <h2 style="font-size: 18px; font-weight: 700; color: #FFFFFF; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #1E293B; padding-bottom: 10px;">📩 New Submission Alert</h2>
    <p style="font-size: 14px; color: #9CA3AF; margin-bottom: 20px;">
      You received a new submission for your form <strong>"${form.name}"</strong>:
    </p>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; text-align: left;">
      <thead>
        <tr style="background-color: #1E293B;">
          <th style="padding: 10px 15px; color: #38BDF8; font-size: 12px; font-weight: 700; text-transform: uppercase; border-top-left-radius: 6px; border-bottom-left-radius: 6px;">Field</th>
          <th style="padding: 10px 15px; color: #38BDF8; font-size: 12px; font-weight: 700; text-transform: uppercase; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">Value</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    
    <div style="text-align: center; margin: 25px 0 10px 0;">
      <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #38BDF8, #0284C7); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 9999px; display: inline-block; box-shadow: 0 4px 12px 0 rgba(14, 165, 233, 0.25); transition: all 0.2s ease;">
        View in Dashboard
      </a>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #4B5563;">
    <p style="margin: 0;">Submission ID: ${submission.id} &bull; Received: ${submission.createdAt}</p>
    <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} FormForge. All rights reserved.</p>
  </div>
</div>
  `;

  if (shouldNotifyEmail && targetEmail) {
    const smtp = getSmtpConfig(form, env as Record<string, string | undefined>, ownerUser);
    if (smtp.enabled && (smtp.hasDbPass || smtp.envPass)) {
      try {
        let decryptedPass = "";
        if (smtp.hasDbPass && smtp.dbPass) {
          const { decryptText } = await import("./encryption");
          decryptedPass = await decryptText(smtp.dbPass);
        } else {
          decryptedPass = smtp.envPass || "";
        }
        const res = await sendSmtpEmail(
          smtp.host!,
          smtp.port,
          smtp.user!,
          decryptedPass,
          smtp.from!,
          targetEmail,
          subject,
          text,
          html
        );
        results.push(
          res.success
            ? { channel: "email", status: "sent" }
            : { channel: "email", status: "failed", error: res.error }
        );
      } catch (error) {
        results.push({ channel: "email", status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      }
    } else if (env.RESEND_API_KEY && env.RESEND_FROM) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: env.RESEND_FROM,
            to: targetEmail,
            subject,
            text,
            html,
          }),
        });

        results.push(
          response.ok
            ? { channel: "email", status: "sent" }
            : { channel: "email", status: "failed", error: await response.text() },
        );
      } catch (error) {
        results.push({ channel: "email", status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      }
    } else if (env.BREVO_API_KEY && env.BREVO_FROM) {
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { email: env.BREVO_FROM, name: "FormForge Alert" },
            to: [{ email: targetEmail }],
            subject,
            textContent: text,
            htmlContent: html,
          }),
        });
        results.push(
          response.ok
            ? { channel: "email", status: "sent" }
            : { channel: "email", status: "failed", error: await response.text() }
        );
      } catch (error) {
        results.push({ channel: "email", status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      }
    } else if (env.SENDGRID_API_KEY && env.SENDGRID_FROM) {
      try {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: targetEmail }] }],
            from: { email: env.SENDGRID_FROM, name: "FormForge Alert" },
            subject,
            content: [
              { type: "text/plain", value: text },
              { type: "text/html", value: html }
            ],
          }),
        });
        results.push(
          response.status === 202
            ? { channel: "email", status: "sent" }
            : { channel: "email", status: "failed", error: await response.text() }
        );
      } catch (error) {
        results.push({ channel: "email", status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      }
    } else if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.MAILGUN_FROM) {
      try {
        const formData = new FormData();
        formData.append("from", env.MAILGUN_FROM);
        formData.append("to", targetEmail ?? "");
        formData.append("subject", subject);
        formData.append("text", text);
        formData.append("html", html);

        const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
          },
          body: formData,
        });
        results.push(
          response.ok
            ? { channel: "email", status: "sent" }
            : { channel: "email", status: "failed", error: await response.text() }
        );
      } catch (error) {
        results.push({ channel: "email", status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
      }
    } else {
      results.push({ channel: "email", status: "skipped" });
    }
  } else {
    results.push({ channel: "email", status: "skipped" });
  }

  // Autoresponder to Submitter
  if (submission.email && form.autoresponderSubject && form.autoresponderBody) {
    let bodyText = form.autoresponderBody;
    let autoresponderSub = form.autoresponderSubject;
    Object.entries(payload).forEach(([k, v]) => {
      bodyText = bodyText.replace(new RegExp(`{${k}}`, "g"), String(v));
      autoresponderSub = autoresponderSub.replace(new RegExp(`{${k}}`, "g"), String(v));
    });
    autoresponderSub = autoresponderSub.replace(/\{name\}/g, (payload.name as string) || (payload.fullName as string) || "Customer");
    autoresponderSub = autoresponderSub.replace(/\{form_name\}/g, form.name);
    autoresponderSub = autoresponderSub.replace(/\{email\}/g, submission.email);

    const autoresponderReplyTo = form.autoresponderReplyTo || targetEmail || undefined;

    const smtp = getSmtpConfig(form, env as Record<string, string | undefined>, ownerUser);
    if (smtp.enabled && (smtp.hasDbPass || smtp.envPass)) {
      try {
        let decryptedPass = "";
        if (smtp.hasDbPass && smtp.dbPass) {
          const { decryptText } = await import("./encryption");
          decryptedPass = await decryptText(smtp.dbPass);
        } else {
          decryptedPass = smtp.envPass || "";
        }
        await sendSmtpEmail(
          smtp.host!,
          smtp.port,
          smtp.user!,
          decryptedPass,
          smtp.from!,
          submission.email,
          autoresponderSub,
          bodyText,
          undefined,
          autoresponderReplyTo
        );
      } catch (error) {
        console.error("Autoresponder SMTP delivery failed:", error);
      }
    } else if (env.RESEND_API_KEY && env.RESEND_FROM) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: env.RESEND_FROM,
            to: submission.email,
            reply_to: autoresponderReplyTo,
            subject: autoresponderSub,
            text: bodyText,
          }),
        });
      } catch (error) {
        console.error("Autoresponder email delivery failed:", error);
      }
    } else if (env.BREVO_API_KEY && env.BREVO_FROM) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { email: env.BREVO_FROM, name: "FormForge" },
            to: [{ email: submission.email }],
            replyTo: autoresponderReplyTo ? { email: autoresponderReplyTo } : undefined,
            subject: autoresponderSub,
            textContent: bodyText,
          }),
        });
      } catch (error) {
        console.error("Autoresponder Brevo email delivery failed:", error);
      }
    } else if (env.SENDGRID_API_KEY && env.SENDGRID_FROM) {
      try {
        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: submission.email }] }],
            from: { email: env.SENDGRID_FROM, name: "FormForge" },
            reply_to: autoresponderReplyTo ? { email: autoresponderReplyTo } : undefined,
            subject: autoresponderSub,
            content: [{ type: "text/plain", value: bodyText }],
          }),
        });
      } catch (error) {
        console.error("Autoresponder SendGrid email delivery failed:", error);
      }
    } else if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.MAILGUN_FROM) {
      try {
        const formData = new FormData();
        formData.append("from", env.MAILGUN_FROM);
        formData.append("to", submission.email);
        if (autoresponderReplyTo) {
          formData.append("h:Reply-To", autoresponderReplyTo);
        }
        formData.append("subject", autoresponderSub);
        formData.append("text", bodyText);

        await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
          },
          body: formData,
        });
      } catch (error) {
        console.error("Autoresponder Mailgun email delivery failed:", error);
      }
    }
  }

  if (form.webhookUrl) {
    const whResult = await dispatchWebhook(db, form, submission, form.webhookUrl);
    results.push(
      whResult.success
        ? { channel: "webhook", status: "sent" }
        : { channel: "webhook", status: "failed", error: whResult.error }
    );
  } else {
    results.push({ channel: "webhook", status: "skipped" });
  }

  // Universal Account-Level Webhook Dispatch
  if (ownerUser?.globalWebhookUrl && ownerUser.globalWebhookUrl !== form.webhookUrl) {
    if (ownerUser.notifyOnSubmission !== false) {
      try {
        let globalWhSecret: string | undefined;
        if (ownerUser.globalWebhookSecret) {
          try {
            const { decryptText } = await import("./encryption");
            globalWhSecret = await decryptText(ownerUser.globalWebhookSecret);
          } catch {}
        }
        const gWhResult = await dispatchWebhook(db, form, submission, ownerUser.globalWebhookUrl, "form.submitted", globalWhSecret);
        if (gWhResult.success) {
          results.push({ channel: "webhook", status: "sent" });
        }
      } catch (e) {
        console.warn("Global webhook delivery error:", e);
      }
    }
  }

  // Google Apps Script (GAS) Webhook & Free Email Relay
  const gasUrl = form.gasUrl || (ownerUser?.notifyOnSubmission !== false ? ownerUser?.globalGasUrl : undefined) || env.GAS_URL;
  if (gasUrl) {
    try {
      let gasSecret = extractGasSecret(gasUrl);
      if (!gasSecret && ownerUser?.globalGasSecret) {
        try {
          const { decryptText } = await import("./encryption");
          gasSecret = await decryptText(ownerUser.globalGasSecret);
        } catch {
          // ignore decryption error
        }
      }
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({
          ...(gasSecret ? { secret: gasSecret } : {}),
          event: "form_submission",
          form: { id: form.id, name: form.name, slug: form.slug },
          submission: { id: submission.id, email: submission.email, createdAt: submission.createdAt },
          payload,
          emailTo: targetEmail,
          to: targetEmail,
          recipient: targetEmail,
          subject,
          text,
          html,
          htmlBody: html,
        }),
      });
      const isSuccess = response.ok || response.status === 302 || response.type === "opaqueredirect";
      results.push(
        isSuccess
          ? { channel: "gas", status: "sent" }
          : { channel: "gas", status: "failed", error: `GAS response: ${response.status}` }
      );
    } catch (error) {
      results.push({ channel: "gas", status: "failed", error: error instanceof Error ? error.message : "GAS delivery error" });
    }
  }

  // Telegram Bot Notification (100% Free, Unlimited)
  const tgToken = form.telegramBotToken || env.TELEGRAM_BOT_TOKEN;
  const tgChatId = form.telegramChatId || env.TELEGRAM_CHAT_ID;
  if (tgToken && tgChatId) {
    try {
      const lines = Object.entries(payload).map(([k, v]) => `• *${k}*: \`${String(v).slice(0, 100)}\``);
      const text = `📬 *New Form Submission*\n\n*Form:* ${form.name}\n*Date:* ${submission.createdAt}\n\n*Data:*\n${lines.join("\n")}`;
      const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text,
          parse_mode: "Markdown",
        }),
      });
      results.push(
        response.ok
          ? { channel: "telegram", status: "sent" }
          : { channel: "telegram", status: "failed", error: `Telegram status ${response.status}` }
      );
    } catch (error) {
      results.push({ channel: "telegram", status: "failed", error: error instanceof Error ? error.message : "Telegram error" });
    }
  }

  // ntfy.sh Free Instant Push Notification
  const ntfyTopic = form.ntfyTopic || env.NTFY_TOPIC;
  if (ntfyTopic) {
    try {
      const response = await fetch(`https://ntfy.sh/${encodeURIComponent(ntfyTopic)}`, {
        method: "POST",
        headers: {
          Title: `New submission: ${form.name}`,
          Priority: "default",
          Tags: "envelope,form",
        },
        body: `New submission from ${submission.email || "visitor"}\n${Object.entries(payload).map(([k, v]) => `${k}: ${v}`).slice(0, 5).join("\n")}`,
      });
      results.push(
        response.ok
          ? { channel: "ntfy", status: "sent" }
          : { channel: "ntfy", status: "failed", error: `ntfy status ${response.status}` }
      );
    } catch (error) {
      results.push({ channel: "ntfy", status: "failed", error: error instanceof Error ? error.message : "ntfy error" });
    }
  }

  await Promise.all(results.map((result) => recordNotification(db, form.id, submission.id, result)));
  return results;
}

export async function sendVerificationEmail(db: AppDb, form: Form, submission: Submission, appUrl: string): Promise<boolean> {
  const env = getRuntimeEnv();
  if (!submission.email) {
    return false;
  }

  const { hmacSha256 } = await import("./crypto");
  const { getAuthSecret } = await import("./auth");
  const secret = getAuthSecret() || form.endpointId;
  const token = await hmacSha256(`verify:${submission.id}:${submission.email}`, secret);
  const verifyUrl = `${appUrl}/api/submissions/${submission.id}/verify?token=${token}`;
  const subject = `📩 Verify your submission to ${form.name}`;
  
  const text = `Hello,\n\nWe received a form submission using your email address for "${form.name}".\n\nPlease verify your email and confirm your submission by clicking the link below:\n\n${verifyUrl}\n\nIf you did not make this submission, you can safely ignore this email.`;
  
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; padding: 40px 10px; text-align: center;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <!-- Header/Logo -->
    <tr>
      <td style="padding: 32px 24px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.04);">
        <table align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align: middle;">
              <img src="https://sudhirdevops1.github.io/FormForge/public/logo.svg" alt="FormForge" width="40" height="40" style="display: block; border-radius: 10px;" onerror="this.src='https://raw.githubusercontent.com/SudhirDevOps1/FormForge/main/public/logo.svg'"/>
            </td>
            <td style="padding-left: 12px; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.03em; vertical-align: middle;">
              FormForge
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Content Body -->
    <tr>
      <td style="padding: 32px 24px 24px; text-align: left;">
        <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 16px; text-align: center;">Confirm Your Submission</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px; text-align: center;">
          Hello,<br><br>
          We received a form submission using your email address for the form <strong>"${form.name}"</strong>.<br>
          To complete your request, please confirm your email address by clicking the button below.
        </p>
        <!-- CTA Button -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 28px auto;">
          <tr>
            <td align="center" bgcolor="#06b6d4" style="border-radius: 9999px;">
              <a href="${verifyUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 600; color: #030712; text-decoration: none; border-radius: 9999px; background: linear-gradient(135deg, #22d3ee, #06b6d4);">
                Confirm Submission
              </a>
            </td>
          </tr>
        </table>
        <p style="font-size: 12px; line-height: 1.5; color: #64748b; text-align: center; margin: 24px 0 0; word-break: break-all;">
          Or copy and paste this URL into your browser:<br>
          <a href="${verifyUrl}" target="_blank" style="color: #06b6d4; text-decoration: none;">${verifyUrl}</a>
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background-color: #0b0f19; text-align: center; border-top: 1px solid rgba(255,255,255,0.04);">
        <p style="font-size: 12px; color: #475569; margin: 0 0 8px; line-height: 1.5;">
          If you did not make this submission, you can safely ignore this email.
        </p>
        <p style="font-size: 11px; color: #334155; margin: 0; line-height: 1.5;">
          © ${new Date().getFullYear()} FormForge · Developed by <a href="https://github.com/SudhirDevOps1" target="_blank" style="color: #475569; text-decoration: underline;">Sudhir Singh</a>
        </p>
      </td>
    </tr>
  </table>
</div>
  `;

  const smtp = getSmtpConfig(form, env as Record<string, string | undefined>);
  if (smtp.enabled && (smtp.hasDbPass || smtp.envPass)) {
    try {
      let decryptedPass = "";
      if (smtp.hasDbPass && smtp.dbPass) {
        const { decryptText } = await import("./encryption");
        decryptedPass = await decryptText(smtp.dbPass);
      } else {
        decryptedPass = smtp.envPass || "";
      }
      const res = await sendSmtpEmail(
        smtp.host!,
        smtp.port,
        smtp.user!,
        decryptedPass,
        smtp.from!,
        submission.email,
        subject,
        text,
        html
      );
      return res.success;
    } catch (error) {
      console.error("Failed to send SMTP email verification:", error);
      return false;
    }
  }

  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: submission.email,
          subject,
          text,
          html,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error("Failed to send Resend email verification:", error);
      return false;
    }
  }

  if (env.BREVO_API_KEY && env.BREVO_FROM) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: env.BREVO_FROM, name: "FormForge" },
          to: [{ email: submission.email }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error("Failed to send Brevo email verification:", error);
      return false;
    }
  }

  if (env.SENDGRID_API_KEY && env.SENDGRID_FROM) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: submission.email }] }],
          from: { email: env.SENDGRID_FROM, name: "FormForge" },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html }
          ],
        }),
      });
      return response.status === 202;
    } catch (error) {
      console.error("Failed to send SendGrid email verification:", error);
      return false;
    }
  }

  if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.MAILGUN_FROM) {
    try {
      const formData = new FormData();
      formData.append("from", env.MAILGUN_FROM);
      formData.append("to", submission.email);
      formData.append("subject", subject);
      formData.append("text", text);
      formData.append("html", html);

      const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
        },
        body: formData,
      });
      return response.ok;
    } catch (error) {
      console.error("Failed to send Mailgun email verification:", error);
      return false;
    }
  }

  return false;
}

export async function sendOtpEmail(form: Form, toEmail: string, code: string): Promise<boolean> {
  const env = getRuntimeEnv();
  const subject = `🔐 Your Verification Code: ${code} (${form.name})`;
  const text = `Your 6-digit verification code for "${form.name}" is:\n\n${code}\n\nThis code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.`;
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; padding: 40px 10px; text-align: center;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden;">
    <tr>
      <td style="padding: 32px 24px; text-align: center;">
        <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 12px;">Verification Code</h2>
        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px;">Use this code to verify your submission to <strong>${form.name}</strong>:</p>
        <div style="background-color: #1e293b; border: 1px dashed #38bdf8; border-radius: 12px; padding: 18px 24px; display: inline-block; margin-bottom: 24px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8;">${code}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; margin: 0;">Expires in 10 minutes &bull; Do not share this code.</p>
      </td>
    </tr>
  </table>
</div>
  `;

  // 1. Google Apps Script Relay (Zero-card Free)
  const gasUrl = form.gasUrl || env.GAS_URL;
  if (gasUrl) {
    try {
      const gasSecret = extractGasSecret(gasUrl);
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({
          ...(gasSecret ? { secret: gasSecret } : {}),
          event: "send_email",
          emailTo: toEmail,
          to: toEmail,
          recipient: toEmail,
          subject,
          text,
          html,
          htmlBody: html,
          code,
          payload: { verification_code: code },
        }),
      });
      if (response.ok || response.status === 302 || response.type === "opaqueredirect") return true;
    } catch (e) {
      console.warn("GAS OTP relay failed, trying other providers:", e);
    }
  }

  // 2. SMTP
  const smtp = getSmtpConfig(form, env as Record<string, string | undefined>);
  if (smtp.enabled && (smtp.hasDbPass || smtp.envPass)) {
    try {
      let decryptedPass = "";
      if (smtp.hasDbPass && smtp.dbPass) {
        const { decryptText } = await import("./encryption");
        decryptedPass = await decryptText(smtp.dbPass);
      } else {
        decryptedPass = smtp.envPass || "";
      }
      const res = await sendSmtpEmail(smtp.host!, smtp.port, smtp.user!, decryptedPass, smtp.from!, toEmail, subject, text, html);
      if (res.success) return true;
    } catch (e) {
      console.warn("SMTP OTP delivery failed:", e);
    }
  }

  // 3. Resend
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: env.RESEND_FROM, to: toEmail, subject, text, html }),
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Resend OTP delivery failed:", e);
    }
  }

  // 4. Brevo
  if (env.BREVO_API_KEY && env.BREVO_FROM) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { email: env.BREVO_FROM, name: form.name },
          to: [{ email: toEmail }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Brevo OTP delivery failed:", e);
    }
  }

  return false;
}

export async function dispatchWebhook(
  db: AppDb,
  form: Form,
  submission: Submission,
  targetUrl: string,
  event = "form.submitted",
  secretToken?: string
): Promise<{ success: boolean; statusCode?: number; latencyMs: number; error?: string }> {
  const env = getRuntimeEnv();
  const deliveryId = randomId("whk");
  const startTime = Date.now();

  try {
    const { isPrivateUrl, normalizeWebhookUrl } = await import("./url-validation");
    const normalizedUrl = normalizeWebhookUrl(targetUrl);
    if (isPrivateUrl(normalizedUrl)) {
      const err = "SSRF prevention: Webhook URL resolves to a private or internal IP address.";
      try {
        await db.insert(webhookLogs).values({
          id: deliveryId,
          formId: form.id,
          submissionId: submission.id,
          url: normalizedUrl,
          event,
          statusCode: 400,
          latencyMs: 0,
          status: "failed",
          error: err,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // safe fallback
      }
      return { success: false, statusCode: 400, latencyMs: 0, error: err };
    }

    const payload = JSON.parse(submission.payload) as Record<string, unknown>;
    let bodyPayload = JSON.stringify({ form: { id: form.id, name: form.name }, submission });
    const lowercaseUrl = normalizedUrl.toLowerCase();

    if (lowercaseUrl.includes("discord.com/api/webhooks") || lowercaseUrl.includes("discordapp.com/api/webhooks")) {
      const fields = Object.entries(payload).map(([k, v]) => ({
        name: k,
        value: String(v).slice(0, 1024) || "(empty)",
        inline: false,
      }));

      bodyPayload = JSON.stringify({
        username: "FormForge",
        embeds: [
          {
            title: `📩 New Submission for ${form.name}`,
            color: 1629853, // Cyan accent color
            fields: fields.slice(0, 25),
            timestamp: new Date(submission.createdAt).toISOString(),
            footer: {
              text: `Form: ${form.name} | Sub ID: ${submission.id}`,
            },
          },
        ],
      });
    } else if (lowercaseUrl.includes("hooks.slack.com")) {
      const fieldsBlocks = Object.entries(payload).map(([k, v]) => ({
        type: "mrkdwn",
        text: `*${k}:*\n${String(v).slice(0, 500) || "_(empty)_"}`,
      }));

      bodyPayload = JSON.stringify({
        text: `New FormForge submission for ${form.name}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `📝 New Submission: ${form.name}`,
            },
          },
          {
            type: "section",
            fields: fieldsBlocks.slice(0, 10),
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Submitted at: ${submission.createdAt}`,
              },
            ],
          },
        ],
      });
    } else if (lowercaseUrl.includes("stoat.chat") || lowercaseUrl.includes("revolt.chat")) {
      const lines = Object.entries(payload).map(([k, v]) => `* **${k}**: ${String(v).slice(0, 500)}`);
      bodyPayload = JSON.stringify({
        content: `📩 **New Submission for ${form.name}**\n\n${lines.join("\n")}\n\n*Submitted at: ${submission.createdAt}*`
      });
    } else if (lowercaseUrl.includes("office.com") || lowercaseUrl.includes("webhook.office") || lowercaseUrl.includes("msteams")) {
      const facts = Object.entries(payload).map(([k, v]) => ({
        name: k,
        value: String(v).slice(0, 500) || "(empty)"
      }));
      bodyPayload = JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": `New Submission for ${form.name}`,
        "title": `📩 New Submission: ${form.name}`,
        "sections": [
          {
            "activityTitle": `Form: ${form.name}`,
            "activitySubtitle": `Sub ID: ${submission.id} | ${submission.createdAt}`,
            "facts": facts.slice(0, 15)
          }
        ]
      });
    } else if (lowercaseUrl.includes("mattermost")) {
      const lines = Object.entries(payload).map(([k, v]) => `* **${k}**: ${String(v).slice(0, 500)}`);
      bodyPayload = JSON.stringify({
        text: `### 📩 New Submission: ${form.name}\n\n${lines.join("\n")}\n\n*Submitted at: ${submission.createdAt}*`
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    let signature = "";
    try {
      const { hmacSha256 } = await import("./crypto");
      signature = await hmacSha256(`${timestamp}.${bodyPayload}`, secretToken || env.AUTH_SECRET || form.id);
    } catch {
      // ignore signature calculation error
    }

    const webhookHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "FormForge/1.0",
      "X-FormForge-Delivery-Id": deliveryId,
      "X-FormForge-Event": event,
      "X-FormForge-Timestamp": String(timestamp),
    };
    if (signature) {
      webhookHeaders["X-FormForge-Signature"] = `t=${timestamp},v1=${signature}`;
    }
    if (secretToken) {
      webhookHeaders["X-FormForge-Secret"] = secretToken;
      webhookHeaders["Authorization"] = `Bearer ${secretToken}`;
    }

    const response = await fetch(normalizedUrl, {
      method: "POST",
      headers: webhookHeaders,
      body: bodyPayload,
      signal: AbortSignal.timeout(15000),
    });

    const latencyMs = Date.now() - startTime;
    const responseText = response.ok ? "" : (await response.text().catch(() => ""));
    const errorMsg = response.ok ? null : (responseText.slice(0, 500) || `HTTP ${response.status}`);

    try {
      await db.insert(webhookLogs).values({
        id: deliveryId,
        formId: form.id,
        submissionId: submission.id,
        url: normalizedUrl,
        event,
        statusCode: response.status,
        latencyMs,
        status: response.ok ? "success" : "failed",
        error: errorMsg,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // safe fallback
    }

    return {
      success: response.ok,
      statusCode: response.status,
      latencyMs,
      error: errorMsg || undefined,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : "Unknown error";

    try {
      await db.insert(webhookLogs).values({
        id: deliveryId,
        formId: form.id,
        submissionId: submission.id,
        url: targetUrl,
        event,
        statusCode: null,
        latencyMs,
        status: "failed",
        error: errMsg,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // safe fallback
    }

    return { success: false, latencyMs, error: errMsg };
  }
}

export async function sendPasswordResetEmail(toEmail: string, code: string, magicLink?: string): Promise<boolean> {
  const env = getRuntimeEnv();
  const subject = `🔐 FormForge Password Reset Code & Magic Link`;
  const text = `Your 6-digit FormForge password reset code is: ${code}

${magicLink ? `Or click this 1-click Magic Link to reset your password immediately:\n${magicLink}\n\n` : ""}This code and link will expire in 15 minutes. If you did not request a password reset, you can safely ignore this email.`;
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; padding: 40px 10px; text-align: center;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden;">
    <tr>
      <td style="padding: 32px 24px; text-align: center;">
        <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 12px;">Admin Password Reset</h2>
        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px;">Enter this 6-digit code or click the magic link button below to reset your FormForge password:</p>
        <div style="background-color: #1e293b; border: 1px dashed #38bdf8; border-radius: 12px; padding: 18px 24px; display: inline-block; margin-bottom: 24px;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8;">${code}</span>
        </div>
        ${magicLink ? `
        <div style="margin: 8px 0 24px;">
          <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 12px;">Prefer 1-click password reset?</p>
          <a href="${magicLink}" style="background: linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%); color: #020617; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Reset Password via Magic Link &rarr;</a>
        </div>
        ` : ""}
        <p style="font-size: 13px; color: #64748b; margin: 0;">Expires in 15 minutes &bull; Do not share this code or link.</p>
      </td>
    </tr>
  </table>
</div>
  `;

  // 1. Google Apps Script Relay (Zero-card Free)
  const gasUrl = env.GAS_URL || env.GAS_WEBHOOK_URL;
  if (gasUrl) {
    try {
      const gasSecret = extractGasSecret(gasUrl);
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({
          ...(gasSecret ? { secret: gasSecret } : {}),
          event: "password_reset",
          emailTo: toEmail,
          to: toEmail,
          recipient: toEmail,
          subject,
          text,
          html,
          htmlBody: html,
          code,
          magicLink,
          magic_link: magicLink,
          reset_link: magicLink,
          payload: { reset_code: code, magic_link: magicLink, expires_in: "15 minutes" },
        }),
      });
      if (response.ok || response.status === 302 || response.type === "opaqueredirect") return true;
    } catch (e) {
      console.warn("GAS password reset relay failed, trying other providers:", e);
    }
  }

  // 2. Global SMTP
  const smtpEnabled = env.SMTP_ENABLED === "true" || env.SMTP_ENABLED === "1";
  const smtpHost = env.SMTP_HOST;
  const smtpPort = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587;
  const smtpUser = env.SMTP_USER;
  const smtpPass = env.SMTP_PASS;
  const smtpFrom = env.SMTP_FROM || smtpUser;

  if (smtpEnabled && smtpHost && smtpUser && smtpPass && smtpFrom) {
    try {
      const res = await sendSmtpEmail(smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, toEmail, subject, text, html);
      if (res.success) return true;
    } catch (e) {
      console.warn("SMTP password reset delivery failed:", e);
    }
  }

  // 3. Direct Email APIs
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: toEmail,
          subject,
          text,
          html,
        }),
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Resend password reset failed:", e);
    }
  }

  if (env.BREVO_API_KEY && env.BREVO_FROM) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: env.BREVO_FROM, name: "FormForge Security" },
          to: [{ email: toEmail }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Brevo password reset failed:", e);
    }
  }

  if (env.SENDGRID_API_KEY && env.SENDGRID_FROM) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: env.SENDGRID_FROM, name: "FormForge Security" },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html }
          ],
        }),
      });
      if (response.status === 202) return true;
    } catch (e) {
      console.warn("SendGrid password reset failed:", e);
    }
  }

  if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.MAILGUN_FROM) {
    try {
      const formData = new FormData();
      formData.append("from", env.MAILGUN_FROM);
      formData.append("to", toEmail);
      formData.append("subject", subject);
      formData.append("text", text);
      formData.append("html", html);

      const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
        },
        body: formData,
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Mailgun password reset failed:", e);
    }
  }

  return false;
}

export async function sendMagicLoginEmail(toEmail: string, magicLink: string): Promise<boolean> {
  const env = getRuntimeEnv();
  const subject = `✨ FormForge 1-Click Magic Sign-In`;
  const text = `Click this 1-click Magic Link to sign in to FormForge immediately:\n\n${magicLink}\n\nThis link will expire in 15 minutes. If you did not request this, you can safely ignore this email.`;
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; padding: 40px 10px; text-align: center;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden;">
    <tr>
      <td style="padding: 32px 24px; text-align: center;">
        <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 12px;">Instant Magic Sign-In</h2>
        <p style="font-size: 14px; color: #94a3b8; margin: 0 0 24px;">Click the button below to sign in to your FormForge Dashboard without entering a password:</p>
        <div style="margin: 12px 0 24px;">
          <a href="${magicLink}" style="background: linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%); color: #020617; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 14px rgba(6,182,212,0.4);">Sign In to FormForge &rarr;</a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0 0 8px;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 11px; font-family: monospace; color: #38bdf8; word-break: break-all; margin: 0 0 24px;">${magicLink}</p>
        <p style="font-size: 12px; color: #475569; margin: 0;">Expires in 15 minutes &bull; Single-use security token.</p>
      </td>
    </tr>
  </table>
</div>
  `;

  // 1. Google Apps Script Relay (Zero-card Free)
  const gasUrl = env.GAS_URL || env.GAS_WEBHOOK_URL;
  if (gasUrl) {
    try {
      const gasSecret = extractGasSecret(gasUrl);
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({
          ...(gasSecret ? { secret: gasSecret } : {}),
          event: "magic_login",
          emailTo: toEmail,
          to: toEmail,
          recipient: toEmail,
          subject,
          text,
          html,
          htmlBody: html,
          magicLink,
          magic_link: magicLink,
          login_link: magicLink,
          payload: { magic_link: magicLink, expires_in: "15 minutes" },
        }),
      });
      if (response.ok || response.status === 302 || response.type === "opaqueredirect") return true;
    } catch (e) {
      console.warn("GAS magic login relay failed, trying other providers:", e);
    }
  }

  // 2. Global SMTP
  const smtpEnabled = env.SMTP_ENABLED === "true" || env.SMTP_ENABLED === "1";
  const smtpHost = env.SMTP_HOST;
  const smtpPort = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587;
  const smtpUser = env.SMTP_USER;
  const smtpPass = env.SMTP_PASS;
  const smtpFrom = env.SMTP_FROM || smtpUser;

  if (smtpEnabled && smtpHost && smtpUser && smtpPass && smtpFrom) {
    try {
      const res = await sendSmtpEmail(smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, toEmail, subject, text, html);
      if (res.success) return true;
    } catch (e) {
      console.warn("SMTP magic login delivery failed:", e);
    }
  }

  // 3. Direct Email APIs
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: toEmail,
          subject,
          text,
          html,
        }),
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Resend magic login failed:", e);
    }
  }

  if (env.BREVO_API_KEY && env.BREVO_FROM) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: env.BREVO_FROM, name: "FormForge Security" },
          to: [{ email: toEmail }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Brevo magic login failed:", e);
    }
  }

  if (env.SENDGRID_API_KEY && env.SENDGRID_FROM) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: env.SENDGRID_FROM, name: "FormForge Security" },
          subject,
          content: [
            { type: "text/plain", value: text },
            { type: "text/html", value: html }
          ],
        }),
      });
      if (response.status === 202) return true;
    } catch (e) {
      console.warn("SendGrid magic login failed:", e);
    }
  }

  if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.MAILGUN_FROM) {
    try {
      const formData = new FormData();
      formData.append("from", env.MAILGUN_FROM);
      formData.append("to", toEmail);
      formData.append("subject", subject);
      formData.append("text", text);
      formData.append("html", html);

      const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
        },
        body: formData,
      });
      if (response.ok) return true;
    } catch (e) {
      console.warn("Mailgun magic login failed:", e);
    }
  }

  return false;
}

export async function sendLoginAlert(user: typeof users.$inferSelect, ip: string, userAgent: string): Promise<void> {
  if (user.notifyOnLogin === false) return;
  const env = getRuntimeEnv();
  const timestamp = new Date().toUTCString();
  const subject = `🔔 Security Alert: New Login to FormForge (${user.name})`;
  const text = `A new login to your FormForge account was detected.\n\nUser: ${user.name} (${user.email})\nTime: ${timestamp}\nIP Address: ${ip}\nDevice: ${userAgent}\n\nIf this was you, you can safely ignore this alert. If you did not log in, please reset your password immediately.`;
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; padding: 40px 10px; color: #f8fafc;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px 24px;">
    <div style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-bottom: 8px;">🔔 Security Alert: New Admin Login</div>
    <p style="font-size: 14px; color: #94a3b8; margin: 0 0 20px;">A successful login to your FormForge account was recorded:</p>
    <div style="background-color: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.8;">
      <div><strong style="color: #ffffff;">Account:</strong> <span style="color: #cbd5e1;">${user.name} (${user.email})</span></div>
      <div><strong style="color: #ffffff;">Time:</strong> <span style="color: #cbd5e1;">${timestamp}</span></div>
      <div><strong style="color: #ffffff;">IP Address:</strong> <span style="color: #38bdf8; font-family: monospace;">${ip}</span></div>
      <div><strong style="color: #ffffff;">Device / Agent:</strong> <span style="color: #94a3b8; word-break: break-all;">${userAgent}</span></div>
    </div>
    <p style="font-size: 12px; color: #64748b; margin: 0;">If this was you, no action is required. If you did not log in, please change your password or revoke active sessions immediately.</p>
  </div>
</div>
  `;

  // 1. Universal / Global GAS Relay
  const gasUrl = user.globalGasUrl || env.GAS_URL;
  if (gasUrl) {
    try {
      let gasSecret = extractGasSecret(gasUrl);
      if (!gasSecret && user.globalGasSecret) {
        try {
          const { decryptText } = await import("./encryption");
          gasSecret = await decryptText(user.globalGasSecret);
        } catch {
          // ignore decryption error
        }
      }
      await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({
          ...(gasSecret ? { secret: gasSecret } : {}),
          event: "admin_login",
          emailTo: user.email,
          to: user.email,
          recipient: user.email,
          subject,
          text,
          html,
          htmlBody: html,
          payload: { ip, userAgent, timestamp, email: user.email, name: user.name },
        }),
      });
    } catch (e) {
      console.warn("GAS login alert failed:", e);
    }
  }

  // 2. Universal / Global Webhook (Stoat, Slack, Discord, Custom)
  if (user.globalWebhookUrl) {
    try {
      const { normalizeWebhookUrl, isPrivateUrl } = await import("./url-validation");
      const targetUrl = normalizeWebhookUrl(user.globalWebhookUrl);
      if (isPrivateUrl(targetUrl)) {
        console.warn("Global webhook blocked by SSRF check:", targetUrl);
        return;
      }

      let webhookSecret: string | undefined;
      if (user.globalWebhookSecret) {
        try {
          const { decryptText } = await import("./encryption");
          webhookSecret = await decryptText(user.globalWebhookSecret);
        } catch {
          // ignore decryption error
        }
      }

      const isStoat = targetUrl.includes("stoat.chat");
      const isDiscord = targetUrl.includes("discord.com");
      const isSlack = targetUrl.includes("slack.com");

      let bodyPayload: Record<string, unknown>;
      if (isStoat) {
        bodyPayload = {
          content: `🔔 **FormForge Security Alert: New Login**\n**User:** ${user.name} (${user.email})\n**IP:** \`${ip}\`\n**Time:** ${timestamp}\n**Device:** ${userAgent}`,
        };
      } else if (isDiscord) {
        bodyPayload = {
          content: `🔔 **Security Alert: New Admin Login**\n> **User:** ${user.name} (${user.email})\n> **IP:** \`${ip}\`\n> **Time:** ${timestamp}`,
        };
      } else if (isSlack) {
        bodyPayload = {
          text: `🔔 *FormForge Security Alert: New Admin Login*\n*User:* ${user.name} (${user.email})\n*IP:* \`${ip}\`\n*Time:* ${timestamp}`,
        };
      } else {
        bodyPayload = {
          event: "admin_login",
          user: { id: user.id, email: user.email, name: user.name },
          ip,
          userAgent,
          timestamp,
        };
      }

      const webhookHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "FormForge/1.0",
      };
      if (webhookSecret) {
        webhookHeaders["X-FormForge-Secret"] = webhookSecret;
        webhookHeaders["Authorization"] = `Bearer ${webhookSecret}`;
      }

      await fetch(targetUrl, {
        method: "POST",
        headers: webhookHeaders,
        body: JSON.stringify(bodyPayload),
      });
    } catch (e) {
      console.warn("Global webhook login alert failed:", e);
    }
  }

  // 3. Universal SMTP / Email
  if (user.globalSmtpEnabled && user.globalSmtpHost && user.globalSmtpUser && user.globalSmtpPass) {
    try {
      const { decryptText } = await import("./encryption");
      const decryptedPass = await decryptText(user.globalSmtpPass);
      await sendSmtpEmail(
        user.globalSmtpHost,
        user.globalSmtpPort || 587,
        user.globalSmtpUser,
        decryptedPass,
        user.globalSmtpFrom || user.globalSmtpUser,
        user.email,
        subject,
        text,
        html
      );
    } catch (e) {
      console.warn("SMTP login alert failed:", e);
    }
  }
}


