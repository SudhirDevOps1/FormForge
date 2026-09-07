const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper to copy directory recursively
function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

const isVercel = process.env.VERCEL === '1' || process.env.NOW_BUILDER !== undefined;
const isNetlify = process.env.NETLIFY === 'true';
const isStandard = process.env.BUILD_TARGET === 'standard' || process.env.BUILD_TARGET === 'node';

if (isVercel || isNetlify || isStandard) {
  console.log(`--- Multi-Platform Build detected (${isVercel ? 'Vercel' : isNetlify ? 'Netlify' : 'Standard'}): Running next build ---`);
  execSync('next build', { stdio: 'inherit' });
} else if (process.env.IN_OPEN_NEXT === 'true') {
  console.log("--- Inside OpenNext: Running standard Next.js build ---");
  execSync('next build', { stdio: 'inherit' });
} else {
  console.log("--- Starting OpenNext Cloudflare Build wrapper ---");
  // Set environment variable to break recursive loops
  process.env.IN_OPEN_NEXT = 'true';
  
  // Choose correct package manager command
  const isBun = process.versions.bun !== undefined || process.env.BUN_VERSION !== undefined;
  const cmd = isBun ? 'bunx' : 'npx';
  
  execSync(`${cmd} opennextjs-cloudflare build`, { stdio: 'inherit', env: process.env });
  console.log("--- OpenNext Cloudflare Build completed successfully ---");

  // --- WINDOWS COMPATIBILITY FIX: Manually copy static assets ---
  console.log("--- Windows Assets copy fix starting... ---");
  const assetsDir = path.join(__dirname, '.open-next', 'assets');
  
  // 1. Copy public assets (e.g. docs.html, guide.html, logo.svg)
  const publicDir = path.join(__dirname, 'public');
  copyFolderSync(publicDir, assetsDir);
  console.log("Copied public folder contents to .open-next/assets");

  // 2. Copy Next.js compiled static CSS/JS chunks
  const staticDir = path.join(__dirname, '.next', 'static');
  const targetStaticDir = path.join(assetsDir, '_next', 'static');
  copyFolderSync(staticDir, targetStaticDir);
  console.log("Copied .next/static folder contents to .open-next/assets/_next/static");

  console.log("--- Windows Assets copy fix completed successfully ---");
}
