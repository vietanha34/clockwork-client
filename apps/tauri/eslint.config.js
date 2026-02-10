import reactConfig from "@clockwork-menubar/eslint-config/react";

/** @type {import("typescript-eslint").Config} */
export default [
  ...reactConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    ignores: ["dist/**", "src-tauri/**"],
  },
];
