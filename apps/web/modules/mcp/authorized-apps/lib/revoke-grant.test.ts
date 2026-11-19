import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getMcpGrantRevokeFailureMessage } from "./revoke-grant";

const t = (key: string) => `t:${key}`;

describe("getMcpGrantRevokeFailureMessage", () => {
  test("translates a refusal by its code", () => {
    const error = new V3ApiError({ status: 409, code: "mcp_grant_changed", detail: "English detail" });
    expect(getMcpGrantRevokeFailureMessage(error, t)).toBe("t:auth.oauth.grant_changed_elsewhere");
  });

  test.each([
    ["a request that never got an answer", new TypeError("Failed to fetch")],
    [
      "a server error with an English detail",
      new V3ApiError({ status: 500, detail: "Internal Server Error" }),
    ],
    ["an unknown code", new V3ApiError({ status: 500, code: "toString", detail: "x" })],
  ])("shows the translated generic failure for %s", (_case, error) => {
    expect(getMcpGrantRevokeFailureMessage(error, t)).toBe("t:auth.oauth.grant_revoke_failed");
  });
});
