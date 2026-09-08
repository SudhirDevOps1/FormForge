function parseIpOctet(value: string): number | null {
  // Decimal, hex (0x7f) and octal (0177) forms — attackers obfuscate loopback
  // and private ranges with non-decimal notation to bypass naive regex checks.
  if (/^0x[0-9a-f]+$/i.test(value)) {
    return parseInt(value, 16);
  }
  if (/^0[0-7]+$/.test(value) && value.length > 1) {
    return parseInt(value, 8);
  }
  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
}

function parseDottedIp(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    const octet = parseIpOctet(part);
    if (octet === null || octet < 0 || octet > 255) {
      return null;
    }
    octets.push(octet);
  }
  return octets as [number, number, number, number];
}

function parseSingleNumberIp(hostname: string): [number, number, number, number] | null {
  // Single-number IPv4 forms: http://2130706433/ and http://0x7f000001/
  let num: number | null = null;
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    num = parseInt(hostname, 16);
  } else if (/^\d+$/.test(hostname)) {
    num = Number(hostname);
  }
  if (num === null || !Number.isSafeInteger(num) || num < 0 || num > 0xffffffff) {
    return null;
  }
  return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
}

export function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);

    // Only http(s) targets are ever valid webhook/redirect destinations.
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return true;
    }

    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      hostname = hostname.slice(1, -1);
    }

    // Check for localhost / loopback aliases
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "::1" ||
      hostname === "::" ||
      hostname === "0.0.0.0"
    ) {
      return true;
    }

    // Internal-only DNS suffixes and the GCP metadata hostname.
    if (
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal"
    ) {
      return true;
    }

    // Check for local IP ranges (SSRF protection)
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (RFC-1918)
    // 127.0.0.0/8 (loopback), 0.0.0.0/8 ("this network")
    // 169.254.0.0/16 (AWS/Cloud Metadata / link-local)
    const octets = parseSingleNumberIp(hostname) ?? parseDottedIp(hostname);

    if (octets) {
      const p1 = octets[0];
      const p2 = octets[1];

      if (p1 === 10) return true;
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
      if (p1 === 192 && p2 === 168) return true;
      if (p1 === 127) return true;
      if (p1 === 169 && p2 === 254) return true;
      if (p1 === 0) return true;
    }

    return false;
  } catch {
    return true; // If malformed, treat as unsafe
  }
}

export function isSafeRedirectUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeWebhookUrl(urlStr: string): string {
  let trimmed = urlStr.trim();
  // Auto-normalize Stoat webhook URLs to the official https://stoat.chat/api/webhooks/
  if (trimmed.includes("stoat.chat")) {
    trimmed = trimmed
      .replace(/^https?:\/\/api\.stoat\.chat\/webhooks\//i, "https://stoat.chat/api/webhooks/")
      .replace(/^https?:\/\/(?:www\.)?stoat\.chat\/webhooks\//i, "https://stoat.chat/api/webhooks/");
  }
  // Auto-fix Revolt webhook URLs:
  trimmed = trimmed.replace(/^https?:\/\/(?:www\.|app\.)?revolt\.chat\/webhooks\//i, "https://api.revolt.chat/webhooks/");
  return trimmed;
}
