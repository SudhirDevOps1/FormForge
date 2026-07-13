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
  type: "r2" | "s3" | "none";
  bucketName?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

export function getStorageConfig(): StorageConfig {
  const env = getRuntimeEnv() as any;

  if (env?.S3_ENDPOINT && env?.S3_ACCESS_KEY_ID && env?.S3_SECRET_ACCESS_KEY && env?.S3_BUCKET_NAME) {
    return {
      type: "s3",
      bucketName: env.S3_BUCKET_NAME,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION || "us-east-1",
    };
  }

  if (env?.FILES_BUCKET) {
    return {
      type: "r2",
      bucketName: "FILES_BUCKET",
    };
  }

  return { type: "none" };
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

  if (config.type === "s3" && config.endpoint && config.accessKeyId && config.secretAccessKey && config.bucketName) {
    // S3 PUT Request
    // Ensure endpoint URL has schema
    let baseEndpoint = config.endpoint.trim();
    if (!baseEndpoint.startsWith("http://") && !baseEndpoint.startsWith("https://")) {
      baseEndpoint = "https://" + baseEndpoint;
    }
    
    // Normalise key path
    const normalizedKey = key.startsWith("/") ? key.substring(1) : key;
    const url = `${baseEndpoint}/${config.bucketName}/${normalizedKey}`;

    const headers = {
      "Content-Type": contentType,
    };

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
      throw new Error(`S3 upload failed with status ${response.status}: ${await response.text()}`);
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

  if (config.type === "s3" && config.endpoint && config.accessKeyId && config.secretAccessKey && config.bucketName) {
    let baseEndpoint = config.endpoint.trim();
    if (!baseEndpoint.startsWith("http://") && !baseEndpoint.startsWith("https://")) {
      baseEndpoint = "https://" + baseEndpoint;
    }

    const normalizedKey = key.startsWith("/") ? key.substring(1) : key;
    const url = `${baseEndpoint}/${config.bucketName}/${normalizedKey}`;

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
