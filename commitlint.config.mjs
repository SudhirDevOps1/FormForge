/**
 * Conventional Commits enforcement for FormForge.
 * Types: feat, fix, docs, chore (+ standard set). Header must stay <= 100 chars.
 */
const commitlintConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
  },
};

export default commitlintConfig;
