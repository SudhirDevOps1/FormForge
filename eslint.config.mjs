import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default defineConfig([
  // Next.js core-web-vitals rules: the pinned eslint-config-next is legacy
  // eslintrc-style, so it is consumed in ESLint 9 flat mode via the
  // official compatibility layer.
  ...compat.extends("next/core-web-vitals"),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
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
