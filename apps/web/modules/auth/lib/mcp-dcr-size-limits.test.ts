import { describe, expect, test } from "vitest";
import { DCR_MAX_BODY_BYTES, DCR_MAX_STRING_LENGTH, findDcrSizeViolation } from "./mcp-dcr-size-limits";

describe("findDcrSizeViolation (ENG-7314)", () => {
  test("accepts a typical registration", () => {
    expect(
      findDcrSizeViolation(JSON.stringify({ client_name: "c", redirect_uris: ["http://127.0.0.1/cb"] }))
    ).toBeNull();
  });

  test("counts bytes, not characters, against the body limit", () => {
    // 3-byte characters: 3000 of them is 9000 bytes but only 3000 characters.
    const body = JSON.stringify({ contacts: Array(10).fill("€".repeat(300)) });
    expect(body.length).toBeLessThan(DCR_MAX_BODY_BYTES);
    expect(findDcrSizeViolation(body)?.description).toContain("bytes");
  });

  test("allows a string of exactly the limit and refuses one over it, including object keys", () => {
    expect(findDcrSizeViolation(JSON.stringify({ a: "x".repeat(DCR_MAX_STRING_LENGTH) }))).toBeNull();
    expect(findDcrSizeViolation(JSON.stringify({ a: "x".repeat(DCR_MAX_STRING_LENGTH + 1) }))).not.toBeNull();
    expect(
      findDcrSizeViolation(JSON.stringify({ ["k".repeat(DCR_MAX_STRING_LENGTH + 1)]: 1 }))
    ).not.toBeNull();
  });

  test("leaves a body that is not JSON for upstream to refuse", () => {
    expect(findDcrSizeViolation("not json")).toBeNull();
  });
});
