// ESLint runs only the @tanstack/oracles rules: oracle files get the
// recommended preset, production source the probe-form rule. Oxlint and
// Ultracite lint everything else.
import oracles from "@tanstack/eslint-plugin-oracles";
import parser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      ...(oracles.configs.recommended.ignores ?? []),
    ],
  },
  { files: ["**/*.ts", "**/*.tsx"], languageOptions: { parser } },
  oracles.configs.recommended,
  oracles.configs.production,
];
