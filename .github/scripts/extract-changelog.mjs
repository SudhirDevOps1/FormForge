/**
 * Extract the Keep-a-Changelog section for a release tag from docs/CHANGELOG.md.
 * Usage: node .github/scripts/extract-changelog.mjs v1.2.0
 * Prints the section body to stdout (tag prefix `v` is optional).
 */
import { readFileSync } from "node:fs";

const rawTag = process.argv[2] || "";
const tag = rawTag.replace(/^v/, "").trim();
if (!tag) {
  console.error("extract-changelog: missing tag argument");
  process.exit(1);
}

const changelog = readFileSync("docs/CHANGELOG.md", "utf8");
const lines = changelog.split("\n");
const collected = [];
let capturing = false;

for (const line of lines) {
  const match = /^##\s+\[?([^\]]+)\]?/.exec(line);
  if (match) {
    if (capturing) {
      break;
    }
    if (match[1].trim() === tag) {
      capturing = true;
    }
    continue;
  }
  if (capturing) {
    collected.push(line);
  }
}

const notes = collected.join("\n").trim();
console.log(notes || `_No changelog section found for ${rawTag}._`);
