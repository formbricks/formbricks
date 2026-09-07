import { describe, expect, test } from "vitest";
import { parseAuthzedUpgradeCliCommand } from "./upgrade-cli-command";

const DIGEST = `sha256:${"a".repeat(64)}`;

describe("parseAuthzedUpgradeCliCommand", () => {
  test.each([
    [["check"], { action: "check" }],
    [["prepare"], { action: "prepare" }],
    [["prepare", "--expected-current-digest", DIGEST], { action: "prepare", expectedCurrentDigest: DIGEST }],
  ])("parses %j", (args, expected) => {
    expect(parseAuthzedUpgradeCliCommand(args)).toEqual(expected);
  });

  test.each([
    { args: [] },
    { args: ["check", "extra"] },
    { args: ["prepare", "--expected-current-digest"] },
    { args: ["prepare", "--expected-current-digest", "sha256:not-a-digest"] },
    { args: ["prepare", "--unknown", DIGEST] },
    { args: ["apply"] },
  ])("rejects $args", ({ args }) => {
    expect(parseAuthzedUpgradeCliCommand(args)).toBeUndefined();
  });
});
