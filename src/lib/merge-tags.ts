/**
 * Zero-dependency, single-pass merge tag interpolator.
 *
 * Replaces `{{field}}` or `{{field | 'fallback'}}` tokens with runtime data.
 * Used for dynamic auto-responders, custom webhook templating, and notification alerts.
 */

export interface RenderMergeTagOptions {
  /** If true, escape HTML characters in interpolated values (&, <, >, ", '). */
  escapeHtml?: boolean;
}

function escapeHtmlString(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Resolves dot-notated property paths safely without prototype pollution.
 */
function getNestedValue(data: Record<string, unknown>, path: string): unknown {
  if (!data || typeof data !== "object") return undefined;
  const segments = path.split(".");

  let current: any = data;
  for (const seg of segments) {
    if (seg === "__proto__" || seg === "constructor" || seg === "prototype") {
      return undefined;
    }
    if (current && typeof current === "object" && seg in current) {
      current = current[seg];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Renders a template string by replacing merge tags with values from `data`.
 *
 * Syntax supported:
 *   - Simple: `{{name}}`, `{{email}}`, `{{_meta.intent}}`
 *   - With fallback: `{{name | 'Valued Customer'}}`, `{{company | 'your company'}}`
 *   - Spacing tolerance: `{{ name | 'Friend' }}`
 */
export function renderMergeTags(
  template: string,
  data: Record<string, unknown>,
  options: RenderMergeTagOptions = {},
): string {
  if (!template || typeof template !== "string") return "";

  return template.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*'([^']*)')?\s*\}\}/g,
    (_, key: string, fallback?: string) => {
      const value = getNestedValue(data, key);

      if (value !== undefined && value !== null && String(value).trim() !== "") {
        const strVal = String(value);
        return options.escapeHtml ? escapeHtmlString(strVal) : strVal;
      }

      const defaultVal = fallback !== undefined ? fallback : "";
      return options.escapeHtml ? escapeHtmlString(defaultVal) : defaultVal;
    },
  );
}

/**
 * Extracts all unique merge tag keys from a template string.
 */
export function extractMergeTags(template: string): string[] {
  if (!template || typeof template !== "string") return [];
  const regex = /\{\{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*'[^']*')?\s*\}\}/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    if (match[1]) matches.add(match[1]);
  }

  return Array.from(matches);
}
