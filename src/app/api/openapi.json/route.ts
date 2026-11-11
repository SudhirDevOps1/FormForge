export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "FormForge API",
      version: "1.0.0",
      description: "Privacy-first serverless form backend by Sudhir Singh. Deployed on Cloudflare Workers + D1.",
      contact: {
        name: "Sudhir Singh",
        url: "https://github.com/SudhirDevOps1/FormForge",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      { url: origin, description: "Current FormForge Instance" },
    ],
    paths: {
      "/api/auth/register": {
        post: {
          summary: "Register new owner account",
          description: "Creates the first admin account. Blocked if ALLOW_REGISTRATION=false.",
          tags: ["Authentication"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 10 },
                    name: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Account created successfully" },
            "403": { description: "Registration disabled" },
            "409": { description: "Email already exists" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          summary: "Login to dashboard",
          tags: ["Authentication"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                    totpCode: { type: "string", description: "6-digit TOTP code if 2FA is enabled" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Login successful or requires2fa challenge" },
            "401": { description: "Invalid credentials or TOTP code" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/auth/2fa/setup": {
        post: {
          summary: "Generate TOTP 2FA secret and setup URI",
          tags: ["Authentication"],
          security: [{ cookieAuth: [] }],
          responses: {
            "200": { description: "Returns secret, formatted key, and otpauth URI" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/auth/2fa/verify": {
        post: {
          summary: "Verify TOTP code and enable 2FA",
          tags: ["Authentication"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["code"],
                  properties: { code: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "2FA activated successfully" },
            "400": { description: "Invalid or expired 6-digit code" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/auth/2fa/disable": {
        post: {
          summary: "Disable 2FA with password or current TOTP code",
          tags: ["Authentication"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    password: { type: "string" },
                    code: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "2FA disabled successfully" },
            "400": { description: "Verification failed" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/submit/{endpointId}": {
        post: {
          summary: "Submit form data",
          tags: ["Submissions"],
          parameters: [
            { name: "endpointId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
              "application/x-www-form-urlencoded": {
                schema: { type: "object", additionalProperties: true },
              },
              "multipart/form-data": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          responses: {
            "200": { description: "Submission accepted" },
            "400": { description: "Validation error (ALTCHA, email, etc.)" },
            "404": { description: "Form not found or inactive" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/forms/{formId}/rules": {
        get: {
          summary: "List conditional-logic rules for a form",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "formId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Rule list plus the supported operators and actions" },
            "401": { description: "Not authenticated" },
            "404": { description: "Form not found" },
          },
        },
        put: {
          summary: "Replace the rule set for a form",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "formId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["rules"],
                  properties: {
                    rules: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["sourceField", "targetField"],
                        properties: {
                          sourceField: { type: "string" },
                          targetField: { type: "string" },
                          operator: {
                            type: "string",
                            enum: [
                              "equals", "not_equals", "contains", "not_contains",
                              "starts_with", "ends_with", "is_empty", "is_not_empty",
                              "gt", "gte", "lt", "lte", "in",
                            ],
                          },
                          action: { type: "string", enum: ["show", "hide", "require"] },
                          value: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "The saved rule set" },
            "401": { description: "Not authenticated" },
            "404": { description: "Form not found" },
          },
        },
      },
      "/api/forms/{formId}/prefills": {
        get: {
          summary: "List URL prefill and hidden-field mappings",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "formId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Mapping list plus the UTM capture flag" },
            "401": { description: "Not authenticated" },
            "404": { description: "Form not found" },
          },
        },
        put: {
          summary: "Replace the prefill mapping set for a form",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "formId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    captureUtm: { type: "boolean" },
                    prefills: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["fieldKey", "paramName"],
                        properties: {
                          fieldKey: { type: "string" },
                          paramName: { type: "string" },
                          isHidden: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "The saved mapping set" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/submit/{endpointId}/partial": {
        post: {
          summary: "Save partial progress and receive a resume token",
          description:
            "Only available when the form has partial submissions enabled. The resume token is stored as a SHA-256 hash and is never persisted in plaintext.",
          tags: ["Submissions"],
          parameters: [
            { name: "endpointId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    payload: { type: "object", additionalProperties: true },
                    completedFieldKeys: { type: "array", items: { type: "string" } },
                    lastStep: { type: "number" },
                    token: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Progress saved; returns a resume token" },
            "403": { description: "Partial submissions are disabled for this form" },
            "429": { description: "Rate limited" },
          },
        },
        get: {
          summary: "Resume a saved partial submission",
          tags: ["Submissions"],
          parameters: [
            { name: "endpointId", in: "path", required: true, schema: { type: "string" } },
            { name: "token", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "The saved payload and progress" },
            "404": { description: "Token invalid or expired" },
          },
        },
      },
      "/api/f/{slug}/unlock": {
        post: {
          summary: "Unlock a password-protected hosted form",
          tags: ["Forms"],
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["password"],
                  properties: { password: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Unlock token (HMAC, form-bound, 6 hour expiry)" },
            "401": { description: "Incorrect password" },
            "429": { description: "Too many attempts" },
          },
        },
      },
      "/api/webhooks/retry-due": {
        post: {
          summary: "Retry webhook deliveries whose backoff window has elapsed",
          description:
            "Intended for a scheduler. Authenticate with the dashboard session or a CRON_SECRET bearer token. Idempotent.",
          tags: ["Webhooks"],
          responses: {
            "200": { description: "Retry summary" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/user/sessions": {
        get: {
          summary: "List the signed-in user's active sessions",
          tags: ["Account"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            "200": { description: "Active sessions with device labels" },
            "401": { description: "Not authenticated" },
          },
        },
        post: {
          summary: "Revoke sessions",
          tags: ["Account"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { keepCurrent: { type: "boolean" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Number of revoked sessions" },
            "401": { description: "Not authenticated" },
          },
        },
        delete: {
          summary: "Revoke a single session",
          tags: ["Account"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Session revoked" },
            "404": { description: "Session not found" },
          },
        },
      },
      "/api/user/audit-logs": {
        get: {
          summary: "Read the administrative audit trail",
          tags: ["Account"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [
            { name: "limit", in: "query", required: false, schema: { type: "integer", maximum: 200 } },
            { name: "offset", in: "query", required: false, schema: { type: "integer" } },
          ],
          responses: {
            "200": { description: "Audit entries for the signed-in user" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/submissions/{submissionId}/notes": {
        get: {
          summary: "List internal notes on a submission",
          tags: ["Submissions"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "submissionId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Notes" },
            "404": { description: "Submission not found" },
          },
        },
        post: {
          summary: "Add an internal note",
          description: "Notes are private to the dashboard and never included in exports, webhooks or emails.",
          tags: ["Submissions"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "submissionId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["body"],
                  properties: { body: { type: "string", maxLength: 4000 } },
                },
              },
            },
          },
          responses: {
            "201": { description: "The saved note" },
            "404": { description: "Submission not found" },
          },
        },
      },
      "/api/submissions/{submissionId}/reply": {
        post: {
          summary: "Reply to a submission by email",
          description:
            "The recipient is always the address captured with the submission; a recipient supplied in the request body is ignored.",
          tags: ["Submissions"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "submissionId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["body"],
                  properties: {
                    body: { type: "string", maxLength: 8000 },
                    subject: { type: "string", maxLength: 200 },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Reply sent" },
            "400": { description: "Submission has no captured email" },
            "502": { description: "No email provider is configured" },
          },
        },
      },
      "/api/forms": {
        get: {
          summary: "List all forms",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          responses: {
            "200": { description: "Array of form objects" },
            "401": { description: "Not authenticated" },
          },
        },
        post: {
          summary: "Create a new form",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    emailTo: { type: "string", format: "email" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Form created" },
            "401": { description: "Not authenticated" },
          },
        },
      },
      "/api/forms/{formId}": {
        get: {
          summary: "Read a single form",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "formId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "The form object" },
            "404": { description: "Form not found" },
          },
        },
        patch: {
          summary: "Update form settings",
          description:
            "Every field is optional. Secrets are encrypted server-side and never returned in plaintext.",
          tags: ["Forms"],
          security: [{ cookieAuth: [] }, { bearerAuth: [] }],
          parameters: [{ name: "formId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    slug: { type: "string" },
                    successMessage: { type: "string" },
                    allowedOrigins: { type: "string" },
                    webhookUrl: { type: "string", nullable: true },
                    slackWebhookUrl: { type: "string", nullable: true },
                    discordWebhookUrl: { type: "string", nullable: true },
                    rateLimitPerMinute: { type: "number", minimum: 1, maximum: 600 },
                    submissionLimit: { type: "number" },
                    tags: { type: "string" },
                    closeAt: { type: "string", nullable: true },
                    captureUtm: { type: "boolean" },
                    partialSubmissionsEnabled: { type: "boolean" },
                    passwordEnabled: { type: "boolean" },
                    password: {
                      type: "string",
                      description:
                        "Sets the access password. Stored as a PBKDF2-SHA256 hash; the plaintext is never persisted.",
                    },
                    encryptPayloads: {
                      type: "boolean",
                      description:
                        "Seals new submission payloads with AES-256-GCM before storage. Existing plaintext rows keep working because the envelope is self-describing.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "The updated form" },
            "400": { description: "Invalid value (weak password, SSRF-blocked URL)" },
            "404": { description: "Form not found" },
          },
        },
      },
      "/api/public-stats": {
        get: {
          summary: "Public statistics",
          tags: ["Public"],
          description: "Returns anonymous aggregate counts (forms, submissions, users). No authentication required.",
          responses: {
            "200": {
              description: "Statistics object",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      submissions: { type: "integer" },
                      forms: { type: "integer" },
                      users: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/health": {
        get: {
          summary: "Health check",
          tags: ["System"],
          responses: {
            "200": { description: "System status" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "ff_session",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "API Key (starts with ff_)",
        },
      },
    },
  };

  return Response.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
