export const ALLOWED_FIELD_TYPES = [
  "text",
  "email",
  "number",
  "tel",
  "url",
  "date",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "file",
  "signature",
] as const;

export type FieldType = (typeof ALLOWED_FIELD_TYPES)[number];

export interface FormFieldInput {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
}

export function sanitizeFieldKey(raw: string): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
}

export function sanitizeFields(raw: unknown): FormFieldInput[] {
  if (!Array.isArray(raw)) return [];

  const seenKeys = new Set<string>();
  const sanitized: FormFieldInput[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;

    const rawKey =
      typeof entry.key === "string"
        ? entry.key
        : typeof entry.fieldKey === "string"
          ? entry.fieldKey
          : "";
    const cleanKey = sanitizeFieldKey(rawKey);

    if (!cleanKey || seenKeys.has(cleanKey)) continue;
    seenKeys.add(cleanKey);

    const rawLabel = typeof entry.label === "string" ? entry.label.trim() : "";
    const cleanLabel = (rawLabel || cleanKey).slice(0, 150);

    const rawType = typeof entry.type === "string" ? entry.type.trim().toLowerCase() : "text";
    const cleanType = (ALLOWED_FIELD_TYPES as readonly string[]).includes(rawType) ? rawType : "text";

    const required = Boolean(entry.required);

    sanitized.push({
      key: cleanKey,
      label: cleanLabel,
      type: cleanType,
      required,
    });

    if (sanitized.length >= 50) break; // Maximum 50 custom fields per form
  }

  return sanitized;
}
