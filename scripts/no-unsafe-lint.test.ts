import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * eslint-plugin-react's `no-deprecated` went with the plugin (ENG-7401). React 19's types no longer
 * declare the APIs it flagged, except the lifecycles React deprecated in 16.9 (`componentWillMount`
 * and the rest). `react/no-unsafe` with `checkAliases` reports those, `UNSAFE_`-prefixed or not, in
 * the `next` and `react` tiers.
 */

const dirOf = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const tiers = { next: dirOf("../apps/web/"), react: dirOf("../packages/survey-ui/") };

const FILE = "modules/no-unsafe/lifecycle.tsx";
const SOURCE = `import { Component } from "react";
export class Hello extends Component<Readonly<{ name: string }>> {
  componentWillMount() {}
  UNSAFE_componentWillReceiveProps() {}
  render() {
    return <div>{this.props.name}</div>;
  }
}
`;

const results = new Map<string, FixtureDiagnostic[]>();

describe("react/no-unsafe reports the deprecated lifecycles", () => {
  beforeAll(() => {
    for (const [tier, dir] of Object.entries(tiers)) {
      results.set(tier, lintFixtures(dir, { [FILE]: SOURCE })[FILE]);
    }
  }, 60_000);

  test.each(Object.keys(tiers))("%s tier", (tier) => {
    const lines = results
      .get(tier)!
      .filter((d) => d.ruleId === "react/no-unsafe" && d.severity === "error")
      .map((d) => d.line);
    expect(lines).toEqual([3, 4]);
  });
});
