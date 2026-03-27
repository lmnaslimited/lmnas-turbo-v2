module.exports = {
  env: {
    es2022: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  ignorePatterns: ["dist", ".next", "coverage"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/src/components/**"],
            message: "Reusable components are not allowed in apps. Use packages/blocks or packages/renderer."
          },
          {
            group: ["axios", "node-fetch", "cross-fetch", "undici"],
            message: "Apps cannot call external APIs directly. Use @lmnas/integrations."
          }
        ]
      }
    ]
  },
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      parser: "@typescript-eslint/parser"
    },
    {
      files: ["apps/**/*.{ts,tsx,js,jsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@lmnas/contracts",
                importNames: ["strapiPageResponseSchema"],
                message: "Apps should consume validated data via @lmnas/integrations or @lmnas/renderer."
              },
              {
                name: "@lmnas/integrations/src/strapiClient",
                message: "Import integrations only through @lmnas/integrations public API."
              },
              {
                name: "@lmnas/integrations/src/lens",
                message: "Use @lmnas/integrations root entrypoint only."
              },
              {
                name: "@lmnas/integrations/src/analytics",
                message: "Use @lmnas/integrations root entrypoint only."
              }
            ],
            patterns: [
              {
                group: ["**/src/components/**", "./components/**", "../components/**"],
                message: "No components folder is allowed inside apps."
              },
              {
                group: [
                  "axios",
                  "node-fetch",
                  "cross-fetch",
                  "undici",
                  "**/strapiClient",
                  "**/n8n*",
                  "**/lens*",
                  "**/rudder*",
                  "services/**"
                ],
                message: "Direct API clients are blocked in apps."
              },
              {
                group: ["@lmnas/integrations/*"],
                message: "Use @lmnas/integrations root entrypoint only."
              }
            ]
          }
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "CallExpression[callee.name='fetch'] Literal[value=/\\/api\\/(pages|navigations|blog-posts?)/]",
            message: "Use @lmnas/integrations GraphQL clients for pages/navigation/blog reads."
          },
          {
            selector:
              "CallExpression[callee.name='fetch'] TemplateLiteral > TemplateElement[value.raw=/\\/api\\/(pages|navigations|blog-posts?)/]",
            message: "Use @lmnas/integrations GraphQL clients for pages/navigation/blog reads."
          }
        ]
      }
    },
    {
      files: ["apps/**/src/components/**/*"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "Program",
            message: "apps/*/src/components/** is forbidden. Move reusable UI to packages/blocks or packages/renderer."
          }
        ],
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["*"],
                message: "apps/*/src/components is forbidden by platform guardrails."
              }
            ]
          }
        ]
      }
    },
    {
      files: ["packages/blocks/**/*.{ts,tsx,js,jsx}"],
      excludedFiles: ["packages/blocks/**/schema.ts"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "CallExpression[callee.name='fetch']",
            message: "Blocks must be pure and must not fetch data."
          }
        ],
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["axios", "node-fetch", "cross-fetch", "undici", "@lmnas/integrations", "@lmnas/integrations/*"],
                message: "Blocks must be pure and cannot call integrations or network clients."
              }
            ]
          }
        ]
      }
    },
    {
      files: ["**/*.{ts,tsx}"],
      excludedFiles: ["packages/contracts/**/*.ts", "packages/blocks/**/schema.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "zod",
                message: "Zod schemas are only allowed in packages/contracts and packages/blocks/*/schema.ts."
              }
            ]
          }
        ]
      }
    }
  ]
};
