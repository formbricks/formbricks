import next from "@formbricks/eslint-config/next";

/*
 * Environment access goes through the validated env module (ENG-1685).
 *
 * `lib/env.ts` parses and type-checks every variable the app consumes at boot (next.config.mjs
 * imports it, so an invalid value fails the build/start instead of the first request that needs
 * it). Reading `process.env` anywhere else opts out of that check and gives contributors a second
 * convention to copy. Client components use `lib/env-client.ts` instead — see the note there.
 */
const PROCESS_ENV_MESSAGE =
  "Read environment variables through the validated env module: `@/lib/env` (or the derived constants in `@/lib/constants`) on the server, `@/lib/env-client` in client components. Direct `process.env` access skips schema validation, so a missing or mistyped variable fails at use-time instead of at boot. Bootstrap, config, script and test files are exempt — see apps/web/eslint.config.mjs.";

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

const config = [
  // carried over from the legacy .eslintignore / ignorePatterns
  {
    ignores: [".next/**", "public/**", "playwright/**", "vendor/**", "**/package.json", "**/tsconfig.json"],
  },
  ...next,
  {
    rules: {
      // runtime-only env read in integration/gen-boolean-client.mjs; hashing it in turbo.json is tracked separately (ENG-1682)
      "turbo/no-undeclared-env-vars": ["error", { allowList: ["PATH"] }],
      // TODO(ENG-1677): enable incrementally — pre-existing violations from the React Compiler-era react-hooks rules
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // Kept as a warning (not off): exhaustive-deps is the main guard against stale closures, and the
      // web lint script has no `--max-warnings 0`, so it surfaces violations without blocking (ENG-1677).
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-syntax": ["error", ...noDirectProcessEnv],
    },
  },
  {
    files: PROCESS_ENV_EXEMPT_FILES,
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default config;
