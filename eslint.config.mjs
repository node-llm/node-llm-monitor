import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.builtin
      }
    }
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "docs/**",
      "examples/**",
      "packages/monitor/dashboard/**", // Ignore bundled dashboard code
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "eslint.config.mjs"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parserOptions: {
        project: ["./packages/*/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "no-console": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-undef": "off" // TypeScript handles this better
    }
  },
  {
    files: ["**/*.mjs", "**/*.js"],
    rules: {
      "no-unused-vars": "warn"
    }
  }
);
