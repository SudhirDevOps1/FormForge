import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("owner"),
    totpSecret: text("totp_secret"),
    totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
    globalSmtpEnabled: integer("global_smtp_enabled", { mode: "boolean" }).notNull().default(false),
    globalSmtpHost: text("global_smtp_host"),
    globalSmtpPort: integer("global_smtp_port").default(587),
    globalSmtpUser: text("global_smtp_user"),
    globalSmtpPass: text("global_smtp_pass"),
    globalSmtpFrom: text("global_smtp_from"),
    globalGasUrl: text("global_gas_url"),
    globalGasSecret: text("global_gas_secret"),
    globalWebhookUrl: text("global_webhook_url"),
    globalWebhookSecret: text("global_webhook_secret"),
    globalNotifyEmail: text("global_notify_email"),
    notifyOnLogin: integer("notify_on_login", { mode: "boolean" }).notNull().default(true),
    notifyOnSubmission: integer("notify_on_submission", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    userIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);

export const forms = sqliteTable(
  "forms",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    endpointId: text("endpoint_id").notNull(),
    description: text("description"),
    redirectUrl: text("redirect_url"),
    successMessage: text("success_message").notNull().default("Thanks! Your response has been received."),
    allowedOrigins: text("allowed_origins").notNull().default("*"),
    honeypotField: text("honeypot_field").notNull().default("website"),
    requireProofOfWork: integer("require_proof_of_work", { mode: "boolean" }).notNull().default(false),
    notifyEmail: integer("notify_email", { mode: "boolean" }).notNull().default(false),
    emailTo: text("email_to"),
    webhookUrl: text("webhook_url"),
    storeIpHash: integer("store_ip_hash", { mode: "boolean" }).notNull().default(true),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    submissionsCount: integer("submissions_count").notNull().default(0),
    altchaEnabled: integer("altcha_enabled", { mode: "boolean" }).notNull().default(false),
    autoresponderSubject: text("autoresponder_subject"),
    autoresponderBody: text("autoresponder_body"),
    spamBlocklist: text("spam_blocklist"),
    retentionDays: integer("retention_days").default(0),
    emailVerificationEnabled: integer("email_verification_enabled", { mode: "boolean" }).notNull().default(false),
    smtpEnabled: integer("smtp_enabled", { mode: "boolean" }).notNull().default(false),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpUser: text("smtp_user"),
    smtpPass: text("smtp_pass"),
    smtpFrom: text("smtp_from"),
    gasUrl: text("gas_url"),
    telegramBotToken: text("telegram_bot_token"),
    telegramChatId: text("telegram_chat_id"),
    ntfyTopic: text("ntfy_topic"),
    otpEnabled: integer("otp_enabled", { mode: "boolean" }).notNull().default(false),
    submissionLimit: integer("submission_limit").default(0),
    emailSubjectTemplate: text("email_subject_template"),
    autoresponderReplyTo: text("autoresponder_reply_to"),
    maxAttachmentSizeMb: integer("max_attachment_size_mb").default(10),
    allowedFileExtensions: text("allowed_file_extensions").default(""),
    displayMode: text("display_mode").notNull().default("classic"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("forms_user_id_idx").on(table.userId),
    endpointIdx: uniqueIndex("forms_endpoint_id_idx").on(table.endpointId),
    slugIdx: uniqueIndex("forms_user_slug_idx").on(table.userId, table.slug),
  }),
);

export const formFields = sqliteTable(
  "form_fields",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull().default("text"),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    formIdx: index("form_fields_form_id_idx").on(table.formId),
    uniqueFieldIdx: uniqueIndex("form_fields_form_key_idx").on(table.formId, table.fieldKey),
  }),
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    payload: text("payload").notNull(),
    email: text("email"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referer: text("referer"),
    status: text("status").notNull().default("accepted"),
    spamScore: integer("spam_score").notNull().default(0),
    spamReasons: text("spam_reasons").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    formIdx: index("submissions_form_id_idx").on(table.formId),
    createdIdx: index("submissions_created_at_idx").on(table.createdAt),
  }),
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: text("scopes").notNull().default("forms:read,submissions:read"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    expiresAt: text("expires_at"),
  },
  (table) => ({
    userIdx: index("api_keys_user_id_idx").on(table.userId),
    hashIdx: uniqueIndex("api_keys_hash_idx").on(table.keyHash),
  }),
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("queued"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    formIdx: index("notifications_form_id_idx").on(table.formId),
    submissionIdx: index("notifications_submission_id_idx").on(table.submissionId),
  }),
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    formId: text("form_id").references(() => forms.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("audit_logs_user_id_idx").on(table.userId),
    formIdx: index("audit_logs_form_id_idx").on(table.formId),
  }),
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: text("reset_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    formId: text("form_id").notNull(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    verifiedAt: text("verified_at"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    formIdx: index("otp_codes_form_id_idx").on(table.formId),
    emailIdx: index("otp_codes_email_idx").on(table.email),
  }),
);

export const webhookLogs = sqliteTable(
  "webhook_logs",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").notNull(),
    url: text("url").notNull(),
    event: text("event").notNull().default("form.submitted"),
    statusCode: integer("status_code"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull(),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    formIdx: index("webhook_logs_form_id_idx").on(table.formId),
    submissionIdx: index("webhook_logs_submission_id_idx").on(table.submissionId),
    createdIdx: index("webhook_logs_created_at_idx").on(table.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;

