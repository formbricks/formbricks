import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * The React Compiler-era rules at "error" sit at zero violations in the codebase, so a clean lint
 * run cannot show they still catch anything. One failing fixture per rule, linted through each
 * tier's real config, proves oxlint's native ports report it as an error.
 *
 * `react/preserve-manual-memoization` has no fixture: the compiler validates it last, after its
 * exhaustive-memo-dependency and immutability checks, which report every mismatch first. Neither
 * oxlint nor eslint-plugin-react-hooks 7.1 reports it on the rule's own documented example. The
 * last test pins its severity instead.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const PROPS = "{ a }: Readonly<{ a: number }>";

const fixtures: Record<string, string> = {
  "react/refs": `import { useRef } from "react";
export function C() {
  const ref = useRef(0);
  return <div>{ref.current}</div>;
}
`,
  "react/use-memo": `import { useMemo } from "react";
export function C(${PROPS}) {
  const value = useMemo(async () => a, [a]);
  return <div>{String(value)}</div>;
}
`,
  "react/static-components": `export function C() {
  const Inner = () => <div />;
  return <Inner />;
}
`,
  "react/globals": `let renders = 0;
export function C() {
  renders = renders + 1;
  return <div>{renders}</div>;
}
`,
  "react/set-state-in-render": `import { useState } from "react";
export function C() {
  const [count, setCount] = useState(0);
  setCount(1);
  return <div>{count}</div>;
}
`,
  "react/error-boundaries": `function Child() {
  return <div />;
}
export function C() {
  try {
    return <Child />;
  } catch {
    return null;
  }
}
`,
  // Not a React Compiler rule, but promoted to "error" on the same terms (ENG-7329). Configured as
  // `react/exhaustive-deps`, it reports under its eslint-plugin-react-hooks name.
  "react-hooks/exhaustive-deps": `import { useEffect } from "react";
export function C(${PROPS}) {
  useEffect(() => {
    console.log(a);
  }, []);
  return <div />;
}
`,
  "react/purity": `export function C() {
  return <div>{Date.now()}</div>;
}
`,
};

// Each tier and the rules it holds at "error". `purity` is still a warning in the react tiers
// (reactCompilerRulesOptOut in packages/config-oxlint/base.mjs).
const tiers = [
  { workspace: "apps/web", dir: "modules/react-compiler", rules: Object.keys(fixtures) },
  {
    workspace: "packages/survey-ui",
    dir: "src/react-compiler",
    rules: Object.keys(fixtures).filter((rule) => rule !== "react/purity"),
  },
  {
    workspace: "packages/surveys",
    dir: "src/react-compiler",
    rules: Object.keys(fixtures).filter((rule) => rule !== "react/purity"),
  },
];

const fileFor = (dir: string, rule: string) => `${dir}/${rule.split("/").pop()}.tsx`;

const results = new Map<string, Record<string, FixtureDiagnostic[]>>();

describe("error-level React Compiler rules and exhaustive-deps report through each tier", () => {
  beforeAll(() => {
    for (const { workspace, dir, rules } of tiers) {
      results.set(
        workspace,
        lintFixtures(
          `${root}${workspace}`,
          Object.fromEntries(rules.map((rule) => [fileFor(dir, rule), fixtures[rule]]))
        )
      );
    }
  }, 60_000);

  test.each(tiers.flatMap(({ workspace, dir, rules }) => rules.map((rule) => [workspace, rule, dir])))(
    "%s: %s",
    (workspace, rule, dir) => {
      const diagnostics = results.get(workspace)![fileFor(dir, rule)];
      expect(diagnostics, JSON.stringify(diagnostics)).toContainEqual(
        expect.objectContaining({ ruleId: rule, severity: "error" })
      );
    }
  );

  test.each(tiers.map(({ workspace }) => workspace))(
    "%s: react/preserve-manual-memoization is configured at error",
    (workspace) => {
      const { stdout, status, stderr } = spawnSync(
        process.execPath,
        [`${root}node_modules/oxlint/bin/oxlint`, "--print-config", "x.tsx"],
        {
          cwd: `${root}${workspace}`,
          encoding: "utf8",
          env: { ...process.env, NODE_OPTIONS: "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON" },
        }
      );
      expect(status, stderr).toBe(0);
      const { rules } = JSON.parse(stdout) as { rules: Record<string, unknown> };
      expect(rules["react/preserve-manual-memoization"]).toBe("deny");
    }
  );
});
