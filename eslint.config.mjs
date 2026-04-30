import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code Worktrees enthalten eigene .next/-Build-Artefakte —
    // ESLint soll dort gar nicht erst hinschauen, sonst kommen Tausende
    // false-positives aus den Build-Outputs.
    ".claude/**",
  ]),
]);

export default eslintConfig;
