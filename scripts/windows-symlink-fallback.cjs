/**
 * Windows symlink fallback for the OpenNext bundler.
 *
 * OpenNext reproduces the `node_modules` layout of the standalone Next.js
 * build. When that layout contains symlinks — which it does for every
 * package Next.js traces — the bundler recreates them with
 * `fs.symlinkSync()`.
 *
 * On Windows, creating a *symbolic link* requires either Administrator
 * privileges or Developer Mode to be enabled. Creating a *junction point*
 * does not: junctions are directory reparse points that the OS resolves
 * natively, and they behave identically for Node's module resolver.
 *
 * This preload script is injected with `NODE_OPTIONS=--require` so it runs
 * before OpenNext's ES modules are evaluated. It wraps `fs.symlinkSync` so
 * that:
 *
 *   1. A symlink that works is created unchanged.
 *   2. A symlink that fails with EPERM/EACCES on Windows is retried as a
 *      **junction** when the target is a directory.
 *   3. A file target that cannot be linked is copied instead.
 *
 * On Linux and macOS the original behaviour is untouched — the wrapper only
 * engages after a failure.
 */

const fs = require("node:fs");
const path = require("node:path");

const originalSymlinkSync = fs.symlinkSync;

function isWindows() {
  return process.platform === "win32";
}

function canUseJunction(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function copyRecursive(source, destination) {
  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
  } else {
    fs.copyFileSync(source, destination);
  }
}

fs.symlinkSync = function patchedSymlinkSync(target, path_, type, callback) {
  // Node supports an optional callback as the last argument.
  const cb = typeof type === "function" ? type : callback;
  const linkType = typeof type === "function" ? undefined : type;

  try {
    return originalSymlinkSync.call(fs, target, path_, linkType, cb);
  } catch (error) {
    const code = error && error.code;
    const shouldFallback = isWindows() && (code === "EPERM" || code === "EACCES");

    if (!shouldFallback) {
      throw error;
    }

    if (cb) {
      try {
        if (canUseJunction(target)) {
          fs.mkdirSync(path.dirname(path_), { recursive: true });
          originalSymlinkSync.call(fs, target, path_, "junction");
        } else {
          copyRecursive(target, path_);
        }
        cb(null);
      } catch (fallbackError) {
        cb(fallbackError);
      }
      return undefined;
    }

    if (canUseJunction(target)) {
      fs.mkdirSync(path.dirname(path_), { recursive: true });
      return originalSymlinkSync.call(fs, target, path_, "junction");
    }

    copyRecursive(target, path_);
    return undefined;
  }
};
