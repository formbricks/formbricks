import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { fixFixtures, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `react-js/prefer-read-only-props` reports mutable props but must never autofix them: its fixer
 * writes `readonly` members, while CODING_STANDARDS.md asks for the `Readonly<Props>` wrapper, so
 * `pnpm lint:fix` would rewrite components in the wrong style (packages/config-oxlint/plugins/react-js.mjs).
 */

const webDir = fileURLToPath(new URL("../apps/web/", import.meta.url));
const FILE = "modules/read-only-props/hello.tsx";
const SOURCE = `interface Props {
  name: string;
}
export const Hello = ({ name }: Props) => <div>{name}</div>;
`;

describe("react-js/prefer-read-only-props in apps/web", () => {
  test("reports a mutable prop as an error", () => {
    expect(lintFixtures(webDir, { [FILE]: SOURCE })[FILE]).toContainEqual(
      expect.objectContaining({ ruleId: "react-js/prefer-read-only-props", severity: "error" })
    );
  }, 30_000);

  test("leaves the component untouched under --fix", () => {
    expect(fixFixtures(webDir, { [FILE]: SOURCE })[FILE]).toBe(SOURCE);
  }, 30_000);
});
