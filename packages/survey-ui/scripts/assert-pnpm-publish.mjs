#!/usr/bin/env node
/**
 * Publish guard: this package must be released with `pnpm publish`, never `npm publish`.
 *
 * @formbricks/survey-ui is the one workspace package that is actually published (see its
 * README). Its runtime `dependencies` are declared as `"catalog:"`, resolved from the
 * `catalog:` block in pnpm-workspace.yaml (ENG-1689). pnpm rewrites those to concrete
 * versions when it packs the tarball; npm does not — it would ship `"clsx": "catalog:"`
 * verbatim, which no consumer can install. The same applies to `workspace:` specifiers.
 *
 * That failure is invisible at publish time and only surfaces for whoever installs the
 * broken version, so this fails the publish instead. Every release so far was cut by hand
 * (all of 1.0.0–1.0.4 went out in one 66-minute session, with no release workflow), which
 * is exactly the situation where the wrong client gets used.
 *
 * Wired to both `prepublishOnly` and `prepack`, because they cover different escapes:
 * `prepublishOnly` catches `npm publish .`, and `prepack` catches `npm pack` — whose tarball
 * would otherwise carry the raw specifiers and be publishable later via
 * `npm publish <tarball>`, which runs no scripts of its own. Neither hook fires under
 * `--ignore-scripts`; nothing in package.json can close that, so it stays a known hole.
 * `pnpm pack`, `pnpm publish`, `pnpm build` and installs are unaffected — pnpm is allowed,
 * and neither hook runs on install.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* eslint-disable-next-line turbo/no-undeclared-env-vars -- injected by the package manager at
   publish time, not build config: it is never a turbo task input, so declaring it in turbo.json
   would only make every task hash against the client's UA string. */
const userAgent = process.env.npm_config_user_agent ?? "";
const isPnpm = userAgent.startsWith("pnpm/");

if (isPnpm) process.exit(0);

// Name the specifiers that would actually break, so the message cannot go stale.
const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"));
const unresolvable = Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies })
  .filter(([, spec]) => spec.startsWith("catalog:") || spec.startsWith("workspace:"))
  .map(([name, spec]) => `    ${name}: "${spec}"`);

console.error(`
✗ Refusing to publish @formbricks/survey-ui with this client.

  Detected: ${userAgent || "no npm_config_user_agent (unrecognised client)"}
  Required: pnpm

  Only pnpm resolves the catalog:/workspace: specifiers in this package's manifest.
  Publishing with npm would ship these to consumers verbatim, and the install would fail:

${unresolvable.length > 0 ? unresolvable.join("\n") : "    (none right now — but keep the guard: the deps are catalogued)"}

  Run:  pnpm publish --filter @formbricks/survey-ui
`);
process.exit(1);
