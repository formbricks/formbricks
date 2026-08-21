import { describe, expect, test } from "vitest";
import { parseAuthzedOutboxCliCommand } from "./outbox-cli-command";

describe("AuthZed outbox CLI command", () => {
  test.each([
    [["status"], { action: "status" }],
    [["replay"], { action: "replay" }],
    [["drain"], { action: "drain", maxBatches: 100 }],
    [["drain", "--max-batches=1"], { action: "drain", maxBatches: 1 }],
    [["drain", "--max-batches=1000"], { action: "drain", maxBatches: 1000 }],
  ])("parses %j", (args, expected) => {
    expect(parseAuthzedOutboxCliCommand(args as string[])).toEqual(expected);
  });

  test.each([
    [[]],
    [["unknown"]],
    [["status", "extra"]],
    [["replay", "extra"]],
    [["drain", "--max-batches=0"]],
    [["drain", "--max-batches=1001"]],
    [["drain", "--max-batches=1", "--max-batches=2"]],
  ])("rejects %j", (args) => {
    expect(parseAuthzedOutboxCliCommand(args)).toBeUndefined();
  });
});
