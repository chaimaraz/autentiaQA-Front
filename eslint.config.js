// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Base historique du projet écrite avant l'adoption d'ESLint : ces règles
      // restent activées (visibles en CI) mais en warning, pour ne pas bloquer
      // tant que la migration progressive n'est pas faite.
      "@typescript-eslint/no-explicit-any": "warn",
      "@angular-eslint/prefer-inject": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      "@angular-eslint/template/prefer-control-flow": "warn",
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
      // Beaucoup de labels du projet ne sont pas encore liés à leur input
      // (for/id) — vrai sujet d'accessibilité à corriger, mais trop large
      // pour bloquer la CI dès la mise en place du pipeline.
      "@angular-eslint/template/label-has-associated-control": "warn",
    },
  }
]);
