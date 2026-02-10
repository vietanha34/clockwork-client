import nodeConfig from "@clockwork-menubar/eslint-config/node";

/** @type {import("typescript-eslint").Config} */
export default [
  ...nodeConfig,
  {
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
    ignores: ["dist/**"],
  },
];
