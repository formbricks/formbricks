import { defineConfig } from "oxlint";
import { compose, denyWarnings, jsPlugins } from "@formbricks/config-oxlint/base";
import next, { nextCacheRestriction } from "@formbricks/config-oxlint/next";

/*
 * Environment access goes through the validated env module (ENG-1685).
 *
 * `lib/env.ts` parses and type-checks every variable the app consumes at boot (next.config.mjs
 * imports it, so an invalid value fails the build/start instead of the first request that needs
 * it). Reading `process.env` anywhere else opts out of that check and gives contributors a second
 * convention to copy. Client components use `lib/env-client.ts` instead — see the note there.
 *
 * The selectors below cover the idiomatic spellings; they are a convention guardrail, not a
 * security boundary. Anything that hides `process` behind a binding still slips through
 * (`globalThis.process.env.X`, `const p = process; p.env.X`, `const { env } = process; env.X`),
 * because a lint selector cannot follow a value across assignments. Nobody reaches for those by
 * accident, and someone determined to bypass the rule can just write a disable comment.
 *
 * oxlint has no `no-restricted-syntax`; `formbricks/restricted-syntax`
 * (packages/config-oxlint/plugins/formbricks.mjs) takes the same ESLint selector options.
 */
const PROCESS_ENV_MESSAGE =
  "Read environment variables through the validated env module: `@/lib/env` (or the derived constants in `@/lib/constants`) on the server, `@/lib/env-client` in client components. Direct `process.env` access skips schema validation, so a missing or mistyped variable fails at use-time instead of at boot. Bootstrap, config, script and test files are exempt — see apps/web/oxlint.config.ts.";

// Injected by Next.js itself rather than by a deployment, so there is nothing for the schema to
// validate and no way for them to go missing at runtime. `NODE_ENV` is deliberately NOT here: it
// is part of the schema, and server code should read it via `@/lib/constants`.
const FRAMEWORK_INJECTED_ENV_VARS = "^(NEXT_RUNTIME|NEXT_PHASE)$";

const PROCESS_ENV_ACCESS = '[object.object.name="process"][object.property.name="env"]';

const noDirectProcessEnv = [
  // `process.env.SOME_VAR`
  {
    selector: `MemberExpression${PROCESS_ENV_ACCESS}[computed=false]:not([property.name=/${FRAMEWORK_INJECTED_ENV_VARS}/])`,
    message: PROCESS_ENV_MESSAGE,
  },
  // `process.env["SOME_VAR"]` and `process.env[someKey]`
  {
    selector: `MemberExpression${PROCESS_ENV_ACCESS}[computed=true]`,
    message: PROCESS_ENV_MESSAGE,
  },
  // Bare `process.env` — spreading it, destructuring it, or aliasing it would otherwise slip past
  // the two selectors above. The `:not()` skips the inner node of a `process.env.X` access so
  // those are reported once, by the matching selector above.
  {
    selector:
      'MemberExpression[object.name="process"][property.name="env"]:not(MemberExpression > MemberExpression)',
    message: PROCESS_ENV_MESSAGE,
  },
  // Any computed access on `process` — `process["env"]`, process[`env`], `process[key]`. The
  // selectors above all key off `env` being an identifier, so a string or template key would
  // otherwise bypass the rule entirely. Computed access on `process` has no legitimate use in
  // application code, so flagging all of it costs nothing and leaves no spelling uncovered.
  {
    selector: 'MemberExpression[object.name="process"][computed=true]',
    message: PROCESS_ENV_MESSAGE,
  },
];

// Files that legitimately read process.env: the env modules themselves, everything that runs
// before (or outside) the Next.js runtime the module is built for, and tests, which set up the
// environment they exercise.
const PROCESS_ENV_EXEMPT_FILES = [
  "lib/env.ts",
  "next.config.mjs",
  "instrumentation.ts",
  "instrumentation-*.ts",
  "sentry.*.config.ts",
  "scripts/**",
  "integration/**",
  "*.config.{ts,mts,mjs}",
  "**/*.test.{ts,tsx}",
  "**/__mocks__/**",
];

export default defineConfig(
  denyWarnings(
    compose(
      // carried over from the legacy .eslintignore / ignorePatterns, plus eslint-config-next's own
      {
        ignorePatterns: [
          ".next/**",
          "public/**",
          "playwright/**",
          "vendor/**",
          "out/**",
          "build/**",
          "next-env.d.ts",
        ],
      },
      next,
      {
        jsPlugins: [jsPlugins.formbricks],
        rules: {
          // runtime-only env read in integration/gen-boolean-client.mjs; hashing it in turbo.json is tracked separately (ENG-1682)
          "turbo/no-undeclared-env-vars": ["error", { allowList: ["PATH"] }],
          /*
           * React Compiler-era react-hooks rules (ENG-2366), implemented natively by oxlint under
           * `react/`. Each carries the strongest severity its remaining violation count allows, on the
           * same per-rule ratchet as the typescript-eslint baseline (ENG-2264).
           *
           * Note the app does NOT run the React Compiler (there is no `reactCompiler` in
           * next.config.mjs and no babel plugin), which is what splits these two groups apart.
           */

          // Real bug classes in plain React, so worth enforcing whether or not the compiler is on.
          // At zero and enforced: `purity`, `refs` and `use-memo` come from flat.recommended and are
          // deliberately not listed here — nothing to opt out of.
          "react/error-boundaries": "error",
          "react/preserve-manual-memoization": "error",
          // Mutating `useState` values, props or hook arguments (ENG-3071).
          "react/immutability": "error",
          // State an effect sets synchronously: derive it during render, initialise it, or set it in
          // the event that caused it (ENG-3072). A subscription that syncs an external value
          // carries an inline disable with its reason.
          "react/set-state-in-effect": "error",

          // Off (ENG-7401). It reports a component the React Compiler would skip, and the app does not
          // run the compiler, so it flags no defect here. Its 28 sites are react-hook-form's `watch()`
          // and TanStack Table's `useReactTable`, both used on purpose. A disable comment at each site
          // would carry the same reason 28 times. Turn it back on with the compiler.
          "react/incompatible-library": "off",

          // The main guard against stale closures. Upstream ships it at "warn"; it is at zero here, so
          // it fails lint (ENG-7329). A deliberate omission carries an inline disable with its reason.
          "react/exhaustive-deps": "error",

          /*
           * jsx-a11y's recommended set, which the `next` tier turns on at "error". Four of its rules
           * reach zero only through five inline disables, each on a site that already carries a NOSONAR
           * for the same deliberate pattern (a `Trans` link whose text is injected, a stopPropagation
           * wrapper, a focusable scroll region). `no-autofocus` is at the tier's "error" too: a dialog or
           * popover that opens on a field focuses it through Radix's `onOpenAutoFocus`
           * (`modules/ui/lib/focus-on-open.ts`); its inline disables are widgets whose focus follows the
           * user's click (a date picker's day grid, a menu's search field, an inline editor).
           */
          // Not in the recommended set. Added because Sonar (S6819) reported a `role="presentation"`
          // only after push. Where the native element cannot hold the content or layout (`<output>`
          // takes phrasing content only, a clickable `<tr>` cannot be a `<button>`), an inline disable
          // says so.
          "jsx-a11y/prefer-tag-over-role": "error",
        },
        overrides: [
          {
            /*
             * The type-aware half of typescript-eslint's recommendedTypeChecked runs here at "error"
             * (the `next` tier). The rules below still have a backlog, counted when they were turned on
             * (ENG-7329); each is promoted when its count reaches zero.
             */
            files: ["**/*.{ts,tsx,mts,cts}"],
            rules: {
              // 1,807: mostly test mocks typed through vi.fn() without a signature.
              "typescript/no-unsafe-assignment": "off",
              // 1,446, nearly all in tests.
              "typescript/no-unsafe-member-access": "off",
              // 394.
              "typescript/no-unsafe-return": "off",
              // 373.
              "typescript/no-unsafe-call": "off",
              // 226.
              "typescript/no-unsafe-argument": "off",
              // 1,143, 1,071 of them async mocks in tests. Dropping `async` changes what a function
              // returns, so each needs a look rather than an autofix.
              "typescript/require-await": "off",
              // 157: comparisons of a string-valued enum (element types, Prisma error codes) with its
              // string literal, a pattern the codebase uses on purpose.
              "typescript/no-unsafe-enum-comparison": "off",
              // 243, 227 of them async JSX event handlers (`onClick={async () => …}`), React's convention.
              // The other 16 pass an async callback to setImmediate/setInterval or a `() => void` prop;
              // each needs its rejection handled before this is turned on.
              "typescript/no-misused-promises": "off",
              // 45, mostly `String(input)` on a fetch input in tests; a few React keys built from arrays.
              "typescript/no-base-to-string": "off",
              // 19, nearly all rejecting with an AbortSignal's `reason`, which is passed on as received.
              "typescript/prefer-promise-reject-errors": "off",
            },
          },
          {
            // `expect(mock.fn).toHaveBeenCalled()` passes a method unbound by design. typescript-eslint
            // points tests at the jest/vitest-aware variant, which oxlint does not implement.
            files: ["**/*.test.{ts,tsx}", "**/__mocks__/**", "vitestSetup.ts", "**/test-utils.ts"],
            rules: { "typescript/unbound-method": "off" },
          },
          {
            // Runs by hand through tsx against a disposable Redis, never as a Turbo task, so its env reads
            // are not build inputs. ESLint scoped this with an inline config comment, which oxlint does
            // not read.
            files: ["scripts/verify-redis-tls.mjs"],
            rules: {
              "turbo/no-undeclared-env-vars": [
                "error",
                {
                  allowList: [
                    "OPENSSL_BIN",
                    "REDIS_SERVER_BIN",
                    "REDIS_TLS_TEST_URL",
                    "NODE_TLS_REJECT_UNAUTHORIZED",
                  ],
                },
              ],
            },
          },
          {
            files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
            excludeFiles: PROCESS_ENV_EXEMPT_FILES,
            rules: { "formbricks/restricted-syntax": ["error", ...noDirectProcessEnv] },
          },
          {
            // The contract-test helpers read the OpenAPI bundle from disk with js-yaml. Tests only — served
            // code takes the generated schemas from the package root.
            files: ["**/*.{ts,tsx,mts,mjs,js}"],
            excludeFiles: ["**/*.test.{ts,tsx}", "**/__mocks__/**", "integration/**", "scripts/**"],
            rules: {
              "no-restricted-imports": [
                "error",
                {
                  paths: [
                    nextCacheRestriction,
                    {
                      name: "@formbricks/api-v3-schemas/testing",
                      message:
                        "Test-only entry point; import the generated schemas from @formbricks/api-v3-schemas.",
                    },
                  ],
                },
              ],
            },
          },
        ],
      }
    )
  )
);
