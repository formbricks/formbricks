import { describe, expect, test } from "vitest";
import { parseAuthzedActivationCliCommand } from "./activation-cli-command";

const digest = (character: string): `sha256:${string}` => `sha256:${character.repeat(64)}`;
const receipt = "5d847b79-ae35-45d0-9dc5-595c1ccbdf61";

describe("AuthZed activation CLI parser", () => {
  test.each([
    [["status"], { action: "status" }],
    [["runtime-check"], { action: "runtime_check" }],
    [["runtime-wait"], { action: "runtime_wait", intervalMs: 5_000, timeoutMs: 900_000 }],
    [
      ["runtime-wait", "--interval-seconds", "2", "--timeout-seconds", "120"],
      { action: "runtime_wait", intervalMs: 2_000, timeoutMs: 120_000 },
    ],
    [["activate", "--receipt", receipt], { action: "activate", receiptId: receipt }],
    [["finalize", "--receipt", receipt], { action: "finalize", receiptId: receipt }],
    [["abort", "--receipt", receipt], { action: "abort", receiptId: receipt }],
    [["rollback-begin", "--receipt", receipt], { action: "rollback_begin", receiptId: receipt }],
    [["rollback-complete", "--receipt", receipt], { action: "rollback_complete", receiptId: receipt }],
    [["bootstrap"], { action: "bootstrap" }],
  ])("parses %j", (args, expected) => {
    expect(parseAuthzedActivationCliCommand(args as string[])).toEqual(expected);
  });

  test("parses a complete preparation request independent of flag order", () => {
    expect(
      parseAuthzedActivationCliCommand([
        "prepare",
        "--candidate-manifest-digest",
        digest("d"),
        "--bridge-image-digest",
        digest("a"),
        "--expected-current-digest",
        digest("e"),
        "--candidate-image-digest",
        digest("c"),
        "--bridge-manifest-digest",
        digest("b"),
      ])
    ).toEqual({
      action: "prepare",
      bridgeImageDigest: digest("a"),
      bridgeManifestDigest: digest("b"),
      candidateImageDigest: digest("c"),
      candidateManifestDigest: digest("d"),
      expectedCurrentDigest: digest("e"),
    });
  });

  const invalidArgumentCases: ReadonlyArray<ReadonlyArray<string>> = [
    [],
    ["status", "extra"],
    ["activate"],
    ["activate", "--receipt", "not-a-receipt"],
    ["bootstrap", "--candidate-image-digest", digest("a")],
    ["runtime-wait", "--timeout-seconds", "0", "--interval-seconds", "1"],
    ["runtime-wait", "--timeout-seconds", "61", "--interval-seconds", "62"],
    ["runtime-wait", "--timeout-seconds", "3601", "--interval-seconds", "1"],
    ["runtime-wait", "--timeout-seconds", "60", "--interval-seconds", "61"],
    ["prepare", "--bridge-image-digest", digest("a")],
    [
      "prepare",
      "--bridge-image-digest",
      digest("a"),
      "--bridge-manifest-digest",
      digest("b"),
      "--candidate-image-digest",
      digest("c"),
      "--candidate-manifest-digest",
      digest("d"),
      "--candidate-manifest-digest",
      digest("d"),
    ],
  ];

  for (const args of invalidArgumentCases) {
    test(`rejects malformed arguments ${JSON.stringify(args)}`, () => {
      expect(parseAuthzedActivationCliCommand(args)).toBeUndefined();
    });
  }
});
