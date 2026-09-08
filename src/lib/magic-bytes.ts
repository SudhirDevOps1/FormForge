/**
 * Zero-dependency Binary Magic Bytes & File Signature Inspector
 * Protects against disguised malicious uploads (e.g. evil.exe or script.sh renamed to image.png).
 * Fully compatible with Cloudflare Workers (V8) and Node.js runtimes.
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  detectedType?: string;
}

// Known dangerous executable signatures (regardless of extension)
const EXECUTABLE_SIGNATURES: { name: string; match: (b: Uint8Array) => boolean }[] = [
  {
    // DOS / Windows PE Executable (MZ)
    name: "Windows/DOS Executable",
    match: (b) => b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a,
  },
  {
    // Linux ELF Executable (\x7fELF)
    name: "Linux ELF Binary",
    match: (b) => b.length >= 4 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46,
  },
  {
    // Unix / Linux Shell Script Shebang (#!)
    name: "Unix Shell Script",
    match: (b) => b.length >= 2 && b[0] === 0x23 && b[1] === 0x21,
  },
  {
    // Java Class Bytecode (0xCAFEBABE)
    name: "Java Bytecode",
    match: (b) =>
      b.length >= 4 && b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe,
  },
  {
    // Mach-O Binaries (macOS)
    name: "Mach-O Binary",
    match: (b) =>
      b.length >= 4 &&
      ((b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa && (b[3] === 0xce || b[3] === 0xcf)) ||
        (b[0] === 0xce && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) ||
        (b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe)),
  },
];

// Expected signatures for common file formats
const TYPE_SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  pdf: (b) =>
    // %PDF-
    b.length >= 5 &&
    b[0] === 0x25 &&
    b[1] === 0x50 &&
    b[2] === 0x44 &&
    b[3] === 0x46 &&
    b[4] === 0x2d,

  png: (b) =>
    // \x89PNG\r\n\x1a\n
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,

  jpg: (b) =>
    // \xFF\xD8\xFF
    b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,

  jpeg: (b) =>
    // \xFF\xD8\xFF
    b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,

  gif: (b) =>
    // GIF87a or GIF89a
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61,

  webp: (b) =>
    // RIFF....WEBP
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,

  zip: (b) =>
    // PK\x03\x04
    b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,

  // Office OpenXML files (docx, xlsx, pptx) are ZIP archives
  docx: (b) =>
    b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  xlsx: (b) =>
    b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  pptx: (b) =>
    b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
};

/**
 * Validates whether the binary header of a file is safe and matches its declared extension.
 */
export function validateFileSignature(bytes: Uint8Array, extension: string): ValidationResult {
  const ext = extension.toLowerCase().replace(/^\./, "").trim();

  // 1. Unconditionally reject any file containing executable binary signatures
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (sig.match(bytes)) {
      return {
        valid: false,
        reason: `Disguised executable detected: ${sig.name}`,
        detectedType: sig.name,
      };
    }
  }

  // 2. If the extension has a strict signature validator, verify it matches
  const validator = TYPE_SIGNATURES[ext];
  if (validator) {
    if (!validator(bytes)) {
      return {
        valid: false,
        reason: `File header does not match declared extension .${ext}`,
      };
    }
  }

  // 3. Reject HTML / SVG uploads disguised under other extensions or dangerous tags
  // To avoid Stored XSS in browsers
  if (ext === "svg" || ext === "html" || ext === "htm") {
    // Inspect first 512 bytes for active script or event triggers
    const sample = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).toLowerCase();
    if (sample.includes("<script") || sample.includes("javascript:") || sample.includes("onload=")) {
      return {
        valid: false,
        reason: "Disallowed script tags detected in markup file",
      };
    }
  }

  return { valid: true };
}
