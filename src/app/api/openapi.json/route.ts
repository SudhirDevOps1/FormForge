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
