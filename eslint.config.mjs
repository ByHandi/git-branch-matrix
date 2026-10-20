import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import sonarjs from "eslint-plugin-sonarjs";
import { defineConfig, globalIgnores } from "eslint/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  eslintConfigPrettier,
  {
    plugins: { sonarjs },
    rules: {
      "sort-imports": "off",
      "import/order": "off",
      complexity: ["error", 15],
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },
  {
    // shadcn registry components (published from public/r): kept as close to upstream as we can
    files: ["components/ui/**"],
    rules: {
      complexity: "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
