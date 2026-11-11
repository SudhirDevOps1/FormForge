/**
 * FormForge prefill & hidden-field resolution.
 *
 * Two complementary mechanisms:
 *
 *  1. **Mapped prefills** — the owner maps a URL query parameter onto a form
 *     field (`?email=ada@example.com` fills the `email` field). The value is
 *     advisory: it pre-fills the input but the respondent may change it.
 *
 *  2. **Hidden fields** — the value is injected server-side and the input is
 *     never rendered, so the respondent cannot read *or* modify it. These are
 *     the trusted channel for campaign IDs, tenant keys and similar.
 *
 * UTM capture is a convenience layer over the same machinery: when enabled,
 * `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` and `utm_content`
 * are recorded under `utm_*` keys unless the owner already mapped them.
 */

import { isSafeFieldKey } from "./security";

export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/** Keys that must never be prefilled from the URL. */
const RESERVED_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "website",
  "altcha",
  "altcha-response",
  "_ff_pow",
  "_next",
  "_redirect",
  "next",
  "otp",
  "otpCode",
  "code",
  "_otp",
  "_intent",
]);

export interface PrefillMapping {
  id?: string;
  fieldKey: string;
  paramName: string;
  isHidden?: boolean;
  position?: number;
}

export interface ResolvedPrefill {
  /** Field key → value to apply. */
  values: Record<string, string>;
  /** Field keys that must be rendered as hidden inputs. */
  hiddenFields: string[];
  /** Field keys the browser may pre-fill but not treat as read-only. */
  editableFields: string[];
}

/** Validate a mapping row coming from the API. */
export function sanitizePrefillMappings(mappings: unknown): PrefillMapping[] {
  if (!Array.isArray(mappings)) return [];
  const clean: PrefillMapping[] = [];
  const seenFields = new Set<string>();
  const seenParams = new Set<string>();

  for (const candidate of mappings) {
    if (!candidate || typeof candidate !== "object") continue;
    const raw = candidate as Record<string, unknown>;

    const fieldKey = typeof raw.fieldKey === "string" ? raw.fieldKey.trim() : "";
    const paramName = typeof raw.paramName === "string" ? raw.paramName.trim() : "";

    if (!isSafeFieldKey(fieldKey)) continue;
    if (!/^[a-zA-Z0-9_.\-]{1,64}$/.test(paramName)) continue;
    if (RESERVED_KEYS.has(fieldKey) || RESERVED_KEYS.has(paramName)) continue;
    if (seenFields.has(fieldKey) || seenParams.has(paramName)) continue;

    seenFields.add(fieldKey);
    seenParams.add(paramName);

    clean.push({
      id: typeof raw.id === "string" ? raw.id : undefined,
      fieldKey,
      paramName,
      isHidden: Boolean(raw.isHidden),
      position: typeof raw.position === "number" ? raw.position : 0,
    });
  }

  return clean;
}

/**
 * Resolve prefill values for a form.
 *
 * @param mappings Owner-configured param → field mappings.
 * @param search   The raw query string (or a `URLSearchParams`).
 * @param captureUtm Whether to auto-capture UTM parameters.
 */
export function resolvePrefills(
  mappings: PrefillMapping[],
  search: string | URLSearchParams,
  captureUtm = false,
): ResolvedPrefill {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const values: Record<string, string> = {};
  const hiddenFields: string[] = [];
  const editableFields: string[] = [];

  for (const mapping of sanitizePrefillMappings(mappings)) {
    const value = params.get(mapping.paramName);
    if (value === null) continue;

    const trimmed = value.slice(0, 512);
    values[mapping.fieldKey] = trimmed;

    if (mapping.isHidden) {
      hiddenFields.push(mapping.fieldKey);
    } else {
      editableFields.push(mapping.fieldKey);
    }
  }

  if (captureUtm) {
    for (const utm of UTM_PARAMS) {
      const value = params.get(utm);
      if (value === null) continue;
      const key = `utm_${utm.replace(/^utm_/, "")}`;
      if (key in values) continue;
      if (RESERVED_KEYS.has(key)) continue;
      values[key] = value.slice(0, 256);
      hiddenFields.push(key);
    }
  }

  return { values, hiddenFields, editableFields };
}

/**
 * Merge server-resolved hidden values into a submitted payload.
 *
 * Hidden values always win over anything the client sent, because the client
 * is untrusted. Values for fields the owner did not map are ignored.
 */
export function applyHiddenPrefills(
  payload: Record<string, unknown>,
  hiddenValues: Record<string, string>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(hiddenValues)) {
    if (!isSafeFieldKey(key)) continue;
    merged[key] = value;
  }
  return merged;
}
