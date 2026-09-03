import { describe, expect, test } from "vitest";
import { parseAuthzedSchemaCliCommand } from "./schema-cli-command";

describe("parseAuthzedSchemaCliCommand", () => {
  test("parses check and unguarded apply commands", () => {
    expect(parseAuthzedSchemaCliCommand(["check"])).toEqual({ action: "check" });
    expect(parseAuthzedSchemaCliCommand(["apply"])).toEqual({ action: "apply" });
  });

  test("parses a guarded apply command", () => {
    const digest = `sha256:${"a".repeat(64)}`;

    expect(parseAuthzedSchemaCliCommand(["apply", "--expected-current-digest", digest])).toEqual({
      action: "apply",
      expectedCurrentDigest: digest,
    });
  });

  test.each(
    [
      [],
      ["check", "extra"],
      ["apply", "--unknown"],
      ["apply", "--expected-current-digest"],
      ["apply", "--expected-current-digest", "sha256:abcd"],
      ["apply", "--expected-current-digest", `sha256:${"A".repeat(64)}`],
    ].map((args) => [args] as const)
  )("rejects invalid arguments: %j", (args) => {
    expect(parseAuthzedSchemaCliCommand(args)).toBeUndefined();
  });
});
