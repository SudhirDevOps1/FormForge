import { getRuntimeEnv } from "@/db";

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  url?: string;
}

// Helper to sign S3 requests using Web Crypto (Signature V4)
async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer>;
async function hmac(key: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer>;
async function hmac(key: ArrayBuffer, data: string | ArrayBuffer): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const dataBuf = typeof data === "string" ? encoder.encode(data) : data;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, dataBuf);
}

async function sha256(data: string | ArrayBuffer): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuf = typeof data === "string" ? encoder.encode(data) : data;
  const hashBuf = await crypto.subtle.digest("SHA-256", dataBuf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSigningKey(secretKey: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const seedBytes = encoder.encode("AWS4" + secretKey);
  const kDate = await hmac(seedBytes.buffer as ArrayBuffer, date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, "aws4_request");
}

export async function signS3Request(
  method: "PUT" | "GET" | "DELETE",
  urlStr: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string,
  headers: Record<string, string>,
  body: ArrayBuffer | null = null
): Promise<Record<string, string>> {
  const url = new URL(urlStr);
  const datetime = new Date().toISOString().replace(/[: -]/g, "").substring(0, 15) + "Z";
  const date = datetime.substring(0, 8);

  const payloadHash = body ? await sha256(body) : "UNSIGNED-PAYLOAD";

  const allHeaders: Record<string, string> = {
    ...headers,
    "host": url.host,
    "x-amz-date": datetime,
    "x-amz-content-sha256": payloadHash,
  };

  const signedHeaders = Object.keys(allHeaders)
    .map(k => k.toLowerCase())
    .sort()
    .join(";");

  const canonicalHeaders = Object.keys(allHeaders)
    .sort()
    .map(k => `${k.toLowerCase()}:${allHeaders[k].trim()}`)
    .join("\n") + "\n";

  const canonicalQuery = Array.from(url.searchParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // Format canonical URI correctly
  let canonicalUri = url.pathname;
  if (!canonicalUri) canonicalUri = "/";
  // S3 requires absolute path encoding
  canonicalUri = canonicalUri.replace(/\/+/g, "/");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const requestHash = await sha256(canonicalRequest);
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    credentialScope,
    requestHash
  ].join("\n");

  const signingKeyBuf = await getSigningKey(secretAccessKey, date, region, service);
  const signatureBuf = await hmac(signingKeyBuf, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    ...allHeaders,
    "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

export interface StorageConfig {
  type: "b2" | "r2" | "s3" | "none";
  providerName: string;
  bucketName?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

export function getStorageConfig(): StorageConfig {
  const env = getRuntimeEnv() as any;

  // 1. Backblaze B2 (First-Class Support)
  const b2KeyId = env?.B2_APPLICATION_KEY_ID || env?.B2_KEY_ID;
  const b2Key = env?.B2_APPLICATION_KEY || env?.B2_KEY;
  const b2Bucket = env?.B2_BUCKET_NAME;
  if (b2KeyId && b2Key && b2Bucket) {
    const region = env?.B2_REGION || "us-west-004";
    let endpoint = (env?.B2_ENDPOINT || `https://s3.${region}.backblazeb2.com`).trim();
    if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = "https://" + endpoint;
    }
    return {
      type: "b2",
      providerName: "Backblaze B2",
      bucketName: b2Bucket,
      endpoint,
      accessKeyId: b2KeyId,
      secretAccessKey: b2Key,
      region,
    };
  }

  // 2. Cloudflare R2 via S3-Compatible API
  if (env?.R2_ACCESS_KEY_ID && env?.R2_SECRET_ACCESS_KEY && env?.R2_BUCKET_NAME) {
    const accountId = env?.R2_ACCOUNT_ID || "";
    let endpoint = (env?.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).trim();
    if (endpoint && !endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = "https://" + endpoint;
    }
    return {
      type: "r2",
      providerName: "Cloudflare R2 (S3 API)",
      bucketName: env.R2_BUCKET_NAME,
      endpoint,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      region: "auto",
    };
  }

  // 3. Cloudflare R2 via Native Worker Binding
  if (env?.FILES_BUCKET || env?.R2_BUCKET) {
    return {
      type: "r2",
      providerName: "Cloudflare R2 (Native Binding)",
      bucketName: "FILES_BUCKET",
    };
  }

  // 4. AWS S3 / MinIO / Generic S3
  if (env?.S3_ACCESS_KEY_ID && env?.S3_SECRET_ACCESS_KEY && env?.S3_BUCKET_NAME) {
    const region = env?.S3_REGION || "us-east-1";
    let endpoint = (env?.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`).trim();
    if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = "https://" + endpoint;
    }
    return {
      type: "s3",
      providerName: "AWS S3 / Compatible",
      bucketName: env.S3_BUCKET_NAME,
      endpoint,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region,
    };
  }

  return { type: "none", providerName: "Disabled" };
}

function getS3RequestUrl(config: StorageConfig, key: string): string {
  let baseEndpoint = (config.endpoint || "").trim().replace(/\/+$/, "");
  if (!baseEndpoint.startsWith("http://") && !baseEndpoint.startsWith("https://")) {
    baseEndpoint = "https://" + baseEndpoint;
  }
  const normalizedKey = key.startsWith("/") ? key.substring(1) : key;
  return `${baseEndpoint}/${config.bucketName}/${normalizedKey}`;
}

export async function uploadFile(
  key: string,
  fileData: ArrayBuffer,
  contentType: string
): Promise<string | null> {
  const config = getStorageConfig();
  const env = getRuntimeEnv() as any;

  if (config.type === "r2" && env.FILES_BUCKET) {
    await env.FILES_BUCKET.put(key, fileData, {
      httpMetadata: { contentType },
    });
    return key;
  }

  if (
    (config.type === "b2" || config.type === "s3" || config.type === "r2") &&
    config.endpoint &&
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucketName
  ) {
    const url = getS3RequestUrl(config, key);
    const headers = { "Content-Type": contentType };

    const signedHeaders = await signS3Request(
      "PUT",
      url,
      config.accessKeyId,
      config.secretAccessKey,
      config.region || "us-east-1",
      "s3",
      headers,
      fileData
    );

    const response = await fetch(url, {
      method: "PUT",
      headers: signedHeaders,
      body: fileData,
    });

    if (!response.ok) {
      throw new Error(`${config.providerName} upload failed with status ${response.status}: ${await response.text()}`);
    }

    return key;
  }

  return null;
}

export async function getFile(
  key: string
): Promise<{ data: ArrayBuffer | ReadableStream; contentType: string } | null> {
  const config = getStorageConfig();
  const env = getRuntimeEnv() as any;

  if (config.type === "r2" && env.FILES_BUCKET) {
    const object = await env.FILES_BUCKET.get(key);
    if (!object) return null;
    return {
      data: object.body,
      contentType: object.httpMetadata?.contentType || "application/octet-stream",
    };
  }

  if (
    (config.type === "b2" || config.type === "s3" || config.type === "r2") &&
    config.endpoint &&
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucketName
  ) {
    const url = getS3RequestUrl(config, key);

    const signedHeaders = await signS3Request(
      "GET",
      url,
      config.accessKeyId,
      config.secretAccessKey,
      config.region || "us-east-1",
      "s3",
      {}
    );

    const response = await fetch(url, {
      method: "GET",
      headers: signedHeaders,
    });

    if (!response.ok) {
      return null;
    }

    return {
      data: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") || "application/octet-stream",
    };
  }

  return null;
}

export async function deleteFile(key: string): Promise<boolean> {
  const config = getStorageConfig();
  const env = getRuntimeEnv() as any;

  if (config.type === "r2" && env.FILES_BUCKET) {
    await env.FILES_BUCKET.delete(key);
    return true;
  }

  if (
    (config.type === "b2" || config.type === "s3" || config.type === "r2") &&
    config.endpoint &&
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucketName
  ) {
    const url = getS3RequestUrl(config, key);

    const signedHeaders = await signS3Request(
      "DELETE",
      url,
      config.accessKeyId,
      config.secretAccessKey,
      config.region || "us-east-1",
      "s3",
      {}
    );

    const response = await fetch(url, {
      method: "DELETE",
      headers: signedHeaders,
    });

    return response.ok || response.status === 204;
  }

  return false;
}

export async function testStorageConnection(): Promise<{
  ok: boolean;
  provider: string;
  bucket: string;
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  const config = getStorageConfig();
  if (config.type === "none") {
    return {
      ok: false,
      provider: "None",
      bucket: "",
      latencyMs: 0,
      message: "No storage backend configured. Provide B2_*, R2_*, or S3_* environment credentials.",
    };
  }

  const probeKey = `system-probes/probe-${Date.now()}.txt`;
  const probeData = new TextEncoder().encode("FormForge storage probe verification");

  try {
    await uploadFile(probeKey, probeData.buffer as ArrayBuffer, "text/plain");
    const fetched = await getFile(probeKey);
    if (!fetched) {
      throw new Error("Probe file was uploaded but could not be read back.");
    }
    await deleteFile(probeKey);

    const latencyMs = Date.now() - start;
    return {
      ok: true,
      provider: config.providerName,
      bucket: config.bucketName || "Default",
      latencyMs,
      message: `✓ Connected to ${config.providerName} [${config.bucketName}]. Roundtrip: ${latencyMs}ms.`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      provider: config.providerName,
      bucket: config.bucketName || "Unknown",
      latencyMs,
      message: `Storage connection failed: ${err.message || String(err)}`,
    };
  }
}
