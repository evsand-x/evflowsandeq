import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.next-dev/**",
      "**/.nuxt/**",
      "**/.output/**",
      "**/dist/**",
      "**/coverage/**",
      "**/generated/**",
      "**/next-env.d.ts",
      ".codex/skills/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "readonly",
        require: "readonly",
      },
    },
  },
  {
    files: ["**/*.{ts,tsx,vue}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "vue/multi-word-component-names": "off",
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },
  prettier,
);
