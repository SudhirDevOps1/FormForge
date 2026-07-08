import { getRuntimeEnv, type AppDb } from "@/db";
import { notifications, type Form, type Submission } from "@/db/schema";

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

  if (form.notifyEmail && form.emailTo && env.RESEND_API_KEY && env.RESEND_FROM) {
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
          subject: `New ${form.name} submission`,
          text: `FormForge received a new submission for ${form.name}.\n\n${JSON.stringify(payload, null, 2)}`,
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
  } else {
    results.push({ channel: "email", status: "skipped" });
  }

  // Autoresponder to Submitter
  if (submission.email && form.autoresponderSubject && form.autoresponderBody && env.RESEND_API_KEY && env.RESEND_FROM) {
    try {
      let bodyText = form.autoresponderBody;
      Object.entries(payload).forEach(([k, v]) => {
        bodyText = bodyText.replace(new RegExp(`{${k}}`, "g"), String(v));
      });

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
  }

  if (form.webhookUrl) {
    try {
      const { isPrivateUrl } = await import("./url-validation");
      if (isPrivateUrl(form.webhookUrl)) {
        results.push({ channel: "webhook", status: "failed", error: "SSRF prevention: Webhook URL resolves to a private or internal IP address." });
      } else {
        let bodyPayload = JSON.stringify({ form: { id: form.id, name: form.name }, submission });

        if (form.webhookUrl.includes("discord.com/api/webhooks") || form.webhookUrl.includes("discordapp.com/api/webhooks")) {
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
        } else if (form.webhookUrl.includes("hooks.slack.com")) {
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
  if (!submission.email || !env.RESEND_API_KEY || !env.RESEND_FROM) {
    return false;
  }

  const verifyUrl = `${appUrl}/api/submissions/${submission.id}/verify`;

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
        subject: `⚠️ Verify your submission to ${form.name}`,
        text: `Hello,\n\nWe received a form submission using your email address for "${form.name}".\n\nPlease verify your email and confirm your submission by clicking the link below:\n\n${verifyUrl}\n\nIf you did not make this submission, you can safely ignore this email.`,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to send email verification:", error);
    return false;
  }
}
