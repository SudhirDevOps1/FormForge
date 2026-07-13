import { getRuntimeEnv, type AppDb } from "@/db";
import { notifications, type Form, type Submission } from "@/db/schema";
import nodemailer from "nodemailer";

async function sendSmtpEmail(
  host: string,
  port: number,
  user: string,
  pass: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  html?: string
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
    });
    return { success: !!info.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function getSmtpConfig(form: Form, env: Record<string, string | undefined>) {
  const enabled = form.smtpEnabled || (env.SMTP_ENABLED === "true" || env.SMTP_ENABLED === "1");
  const host = form.smtpHost || env.SMTP_HOST;
  const port = form.smtpPort ? Number(form.smtpPort) : (env.SMTP_PORT ? Number(env.SMTP_PORT) : 587);
  const user = form.smtpUser || env.SMTP_USER;
  const from = form.smtpFrom || env.SMTP_FROM;
  
  return {
    enabled: !!(enabled && host && port && user && from),
    host,
    port,
    user,
    from,
    hasDbPass: !!form.smtpPass,
    dbPass: form.smtpPass,
    envPass: env.SMTP_PASS,
  };
}

type DeliveryResult = {
  channel: "email" | "webhook";
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

export async function deliverNotifications(db: AppDb, form: Form, submission: Submission): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  const env = getRuntimeEnv();
  const payload = JSON.parse(submission.payload) as Record<string, unknown>;

  if (form.notifyEmail && form.emailTo) {
    const tableRows = Object.entries(payload)
      .map(([k, v]) => `
        <tr>
          <td style="padding: 12px 15px; border-bottom: 1px solid #1E293B; font-weight: 600; color: #FFFFFF; font-size: 14px; width: 30%;">${k}</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #1E293B; color: #9CA3AF; font-size: 14px; word-break: break-all;">${String(v)}</td>
        </tr>
      `).join("");

    const text = `FormForge received a new submission for ${form.name}.\n\n${JSON.stringify(payload, null, 2)}`;
    const subject = `📩 New submission for ${form.name}`;

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
      <a href="https://apnaform.sudhirdevops1.workers.dev/dashboard" style="background: linear-gradient(135deg, #38BDF8, #0284C7); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 9999px; display: inline-block; box-shadow: 0 4px 12px 0 rgba(14, 165, 233, 0.25); transition: all 0.2s ease;">
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
          form.emailTo,
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
            to: form.emailTo,
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
            to: [{ email: form.emailTo }],
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
            personalizations: [{ to: [{ email: form.emailTo }] }],
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
        formData.append("to", form.emailTo ?? "");
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
    Object.entries(payload).forEach(([k, v]) => {
      bodyText = bodyText.replace(new RegExp(`{${k}}`, "g"), String(v));
    });

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
        await sendSmtpEmail(
          smtp.host!,
          smtp.port,
          smtp.user!,
          decryptedPass,
          smtp.from!,
          submission.email,
          form.autoresponderSubject,
          bodyText
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
            subject: form.autoresponderSubject,
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
            subject: form.autoresponderSubject,
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
            subject: form.autoresponderSubject,
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
        formData.append("subject", form.autoresponderSubject);
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
    try {
      const { isPrivateUrl } = await import("./url-validation");
      if (isPrivateUrl(form.webhookUrl)) {
        results.push({ channel: "webhook", status: "failed", error: "SSRF prevention: Webhook URL resolves to a private or internal IP address." });
      } else {
        let bodyPayload = JSON.stringify({ form: { id: form.id, name: form.name }, submission });

        const lowercaseUrl = form.webhookUrl.toLowerCase();

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
          // Stoat/Revolt expects a "content" string for simple messages
          const lines = Object.entries(payload).map(([k, v]) => `* **${k}**: ${String(v).slice(0, 500)}`);
          bodyPayload = JSON.stringify({
            content: `📩 **New Submission for ${form.name}**\n\n${lines.join("\n")}\n\n*Submitted at: ${submission.createdAt}*`
          });
        } else if (lowercaseUrl.includes("office.com") || lowercaseUrl.includes("webhook.office") || lowercaseUrl.includes("msteams")) {
          // MS Teams Office 365 Connector card
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
          // Mattermost custom markdown message
          const lines = Object.entries(payload).map(([k, v]) => `* **${k}**: ${String(v).slice(0, 500)}`);
          bodyPayload = JSON.stringify({
            text: `### 📩 New Submission: ${form.name}\n\n${lines.join("\n")}\n\n*Submitted at: ${submission.createdAt}*`
          });
        }

        const response = await fetch(form.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "FormForge/1.0" },
          body: bodyPayload,
        });

        results.push(
          response.ok
            ? { channel: "webhook", status: "sent" }
            : { channel: "webhook", status: "failed", error: await response.text() },
        );
      }
    } catch (error) {
      results.push({ channel: "webhook", status: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    }
  } else {
    results.push({ channel: "webhook", status: "skipped" });
  }

  await Promise.all(results.map((result) => recordNotification(db, form.id, submission.id, result)));
  return results;
}

export async function sendVerificationEmail(db: AppDb, form: Form, submission: Submission, appUrl: string): Promise<boolean> {
  const env = getRuntimeEnv();
  if (!submission.email) {
    return false;
  }

  const verifyUrl = `${appUrl}/api/submissions/${submission.id}/verify`;
  const subject = `📩 Verify your submission to ${form.name}`;
  
  const text = `Hello,\n\nWe received a form submission using your email address for "${form.name}".\n\nPlease verify your email and confirm your submission by clicking the link below:\n\n${verifyUrl}\n\nIf you did not make this submission, you can safely ignore this email.`;
  
  const html = `
<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0B0F19; color: #F1F5F9; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #1E293B;">
  <div style="text-align: center; margin-bottom: 30px;">
    <div style="font-size: 24px; font-weight: 800; color: #0EA5E9; letter-spacing: -0.05em; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
      <span style="background: linear-gradient(135deg, #0EA5E9, #2563EB); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: sans-serif;">FormForge</span>
    </div>
  </div>
  <div style="background-color: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 30px; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
    <h2 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin-top: 0; margin-bottom: 16px; text-align: center;">Verify Your Form Submission</h2>
    <p style="font-size: 15px; color: #9CA3AF; line-height: 1.6; margin-bottom: 24px; text-align: center;">
      Hello,<br><br>
      We received a new form submission using your email address for the form <strong>"${form.name}"</strong>. To confirm this was you and authorize the submission, please verify your email address.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="background: linear-gradient(135deg, #38BDF8, #0284C7); color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 9999px; display: inline-block; box-shadow: 0 4px 14px 0 rgba(14, 165, 233, 0.3); transition: all 0.2s ease;">
        Confirm Submission
      </a>
    </div>
    <p style="font-size: 12px; color: #6B7280; text-align: center; margin-top: 24px; word-break: break-all;">
      Or copy and paste this link in your browser:<br>
      <a href="${verifyUrl}" style="color: #38BDF8; text-decoration: none;">${verifyUrl}</a>
    </p>
  </div>
  <div style="text-align: center; font-size: 12px; color: #4B5563; line-height: 1.5;">
    <p style="margin: 0;">If you did not make this submission, you can safely ignore this email.</p>
    <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} FormForge. All rights reserved.</p>
  </div>
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
