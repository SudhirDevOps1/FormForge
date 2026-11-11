import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/**
 * FormForge ESLint configuration.
 *
 * `eslint-config-next@16` ships native flat config, so it is consumed
 * directly — no `FlatCompat` shim is needed (the shim breaks on the v16
 * plugin graph because of a circular reference in the plugin registry).
 *
 * Only `core-web-vitals` is enabled, matching the rule set the project has
 * always linted against. The optional `typescript` preset is intentionally
 * left off: it turns on `no-explicit-any` / `no-unused-vars` across the
 * whole tree, which is a separate, deliberate change rather than a
 * dependency bump.
 */
export default defineConfig([
  ...nextCoreWebVitals,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".tmp-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
  {
    rules: {
      // Calling async data-fetching functions inside useEffect is the standard React pattern.
      // The new react-hooks/set-state-in-effect rule is overly strict and produces false positives.
      "react-hooks/set-state-in-effect": "off",
      // Date.now() and similar in render is flagged by purity but is acceptable for expiry checks.
      "react-hooks/purity": "off",
      // Unescaped entities in JSX prose text
      "react/no-unescaped-entities": "off",
      // SVG and public logos do not require next/image optimization
      "@next/next/no-img-element": "off",
    },
  },
]);
