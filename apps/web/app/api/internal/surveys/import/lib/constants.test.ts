import { describe, expect, test } from "vitest";
import { QSF_IMPORT_HEARTBEAT_MS } from "./constants";

describe("import stream transport", () => {
  test("the heartbeat keeps the stream well inside a 60 s proxy read timeout", () => {
    expect(QSF_IMPORT_HEARTBEAT_MS).toBeLessThanOrEqual(15_000);
  });
});
