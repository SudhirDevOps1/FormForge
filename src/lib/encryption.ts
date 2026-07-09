import { getRuntimeEnv } from "@/db";

/**
 * Encrypts plain text using AES-GCM and the application's AUTH_SECRET.
 */
export async function encryptText(text: string): Promise<string> {
  if (!text) return "";
  const env = getRuntimeEnv();
  const secret = env.AUTH_SECRET || "default-secret-key-change-in-prod";

  const encoder = new TextEncoder();
  const rawKey = encoder.encode(secret.padEnd(32, "0").slice(0, 32));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(text)
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts encrypted base64 text using AES-GCM and the application's AUTH_SECRET.
 */
export async function decryptText(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64) return "";
  try {
    const env = getRuntimeEnv();
    const secret = env.AUTH_SECRET || "default-secret-key-change-in-prod";

    const encoder = new TextEncoder();
    const rawKey = encoder.encode(secret.padEnd(32, "0").slice(0, 32));

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    const binaryString = atob(encryptedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    return "";
  }
}
