import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, fixFixtures, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `formbricks/prefer-read-only-props` (packages/config-oxlint/plugins/formbricks.mjs) replaced
 * eslint-plugin-react's rule, which ran as the `react-js` JS plugin and cost about half of apps/web's
 * lint run (ENG-7401). It must report what the old rule reported: one fixture per way a component
 * declares its props, linted through the `next` and `react` tiers. It must never autofix, because
 * CODING_STANDARDS.md asks for the `Readonly<Props>` wrapper rather than `readonly` members.
 */

const dirOf = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const RULE = "formbricks/prefer-read-only-props";

const tiers = { next: dirOf("../apps/web/"), react: dirOf("../packages/survey-ui/") };

// Each reports `name` as mutable.
const mutable: Record<string, string> = {
  "interface.tsx": `interface Props {
  name: string;
}
export const Hello = ({ name }: Props) => <div>{name}</div>;
`,
  "type-literal.tsx": `export function Hello({ name }: { name: string }) {
  return <div>{name}</div>;
}
`,
  "declared-after.tsx": `export const Hello = (props: Props) => <div>{props.name}</div>;
type Props = { name: string };
`,
  "intersection.tsx": `import type { ComponentProps } from "react";
interface Own {
  name: string;
}
export const Hello = ({ name }: ComponentProps<"div"> & Own) => <div>{name}</div>;
`,
  "extends.tsx": `interface Base {
  name: string;
}
interface Props extends Base {
  readonly id: string;
}
export const Hello = ({ name, id }: Props) => <div id={id}>{name}</div>;
`,
  "fc.tsx": `import type { FC } from "react";
interface Props {
  name: string;
}
export const Hello: FC<Props> = ({ name }) => <div>{name}</div>;
`,
  "forward-ref.tsx": `import { forwardRef, memo } from "react";
interface Props {
  name: string;
}
export const Hello = memo(forwardRef<HTMLDivElement, Props>(({ name }, ref) => <div ref={ref}>{name}</div>));
`,
  "default-export.tsx": `interface Props {
  name: string;
}
export default function ({ name }: Props) {
  return <div>{name}</div>;
}
`,
  "default-value.tsx": `interface Props {
  name: string;
}
export const Hello = ({ name }: Props = { name: "" }) => <div>{name}</div>;
`,
  "object-key.tsx": `interface Props {
  name: string;
}
export const components = { Hello: ({ name }: Props) => <div>{name}</div> };
`,
  "namespace-forward-ref.tsx": `import * as React from "react";
import type { Base } from "./base";
interface Props {
  name: string;
}
// The type argument names the props even where the parameter carries its own annotation.
export const Hello = React.forwardRef<HTMLDivElement, Props>(({ name }: Base, ref) => (
  <div ref={ref}>{name}</div>
));
`,
  "class-props-field.tsx": `import { Component } from "react";
interface Props {
  name: string;
}
export class Hello extends Component {
  declare props: Props;
  render() {
    return <div>{this.props.name}</div>;
  }
}
`,
  "returns-null.tsx": `interface Props {
  name: string;
}
// A component that renders nothing, like the analytics identifiers.
export function Hello({ name }: Props) {
  console.info(name);
  return null;
}
`,
  "async.tsx": `interface Props {
  name: Promise<string>;
}
export const Hello = async ({ name }: Props) => <div>{await name}</div>;
`,
  "class.tsx": `import { Component } from "react";
interface Props {
  name: string;
}
export class Hello extends Component<Props> {
  render() {
    return <div>{this.props.name}</div>;
  }
}
`,
};

// None of these reports.
const clean: Record<string, string> = {
  "readonly-wrapper.tsx": `interface Props {
  name: string;
}
export const Hello = ({ name }: Readonly<Props>) => <div>{name}</div>;
`,
  "readonly-members.tsx": `interface Props {
  readonly name: string;
}
export const Hello = ({ name }: Props) => <div>{name}</div>;
`,
  // The wrapper's type argument wins over the parameter's annotation, as it did in eslint-plugin-react.
  "forward-ref-named.tsx": `import { forwardRef } from "react";
interface Props {
  name: string;
}
export const Hello = forwardRef<HTMLDivElement, Readonly<Props>>(function Hello(props: Props, ref) {
  return <div ref={ref}>{props.name}</div>;
});
`,
  // A props type from another file is not looked into, as eslint-plugin-react did not.
  "imported.tsx": `import type { Props } from "./props";
export const Hello = ({ name }: Props) => <div>{name}</div>;
`,
  // Not components: camelCase, or a PascalCase function that returns no JSX.
  "not-components.tsx": `interface Options {
  name: string;
}
export const renderHello = ({ name }: Options) => <div>{name}</div>;
export function GET({ name }: Options) {
  return new Response(name);
}
`,
};

const withDir = (files: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(files).map(([file, source]) => [`modules/read-only-props/${file}`, source])
  );

const results = new Map<string, Record<string, FixtureDiagnostic[]>>();
const reports = (tier: string, file: string) =>
  results.get(tier)![`modules/read-only-props/${file}`].filter((d) => d.ruleId === RULE);

describe("formbricks/prefer-read-only-props", () => {
  beforeAll(() => {
    for (const [tier, dir] of Object.entries(tiers)) {
      results.set(tier, lintFixtures(dir, withDir({ ...mutable, ...clean })));
    }
  }, 60_000);

  describe.each(Object.keys(tiers))("%s tier", (tier) => {
    test.each(Object.keys(mutable))("reports the mutable prop in %s as an error", (file) => {
      expect(reports(tier, file)).toEqual([
        expect.objectContaining({ severity: "error", message: expect.stringContaining("'name'") }),
      ]);
    });

    test.each(Object.keys(clean))("reports nothing in %s", (file) => {
      expect(reports(tier, file)).toEqual([]);
    });
  });

  test("leaves the component untouched under --fix", () => {
    const file = "modules/read-only-props/interface.tsx";
    expect(fixFixtures(tiers.next, { [file]: mutable["interface.tsx"] })[file]).toBe(
      mutable["interface.tsx"]
    );
  }, 30_000);
});
