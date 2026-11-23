import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getInviteRefusalState } from "./acceptance-refusal";

describe("getInviteRefusalState", () => {
  test.each([
    [
      "an existing membership",
      new V3ApiError({ status: 409, detail: "", details: { reason: "already_member" } }),
      "alreadyMember",
    ],
    [
      "an expired invite",
      new V3ApiError({ status: 422, detail: "", details: { reason: "invite_expired" } }),
      "expired",
    ],
    ["an invite no longer valid for this user", new V3ApiError({ status: 403, detail: "" }), "notFound"],
  ])("answers the screen for %s", (_label, error, state) => {
    expect(getInviteRefusalState(error)).toBe(state);
  });

  test.each([
    ["a request that got no answer", new V3ApiError({ status: 0, detail: "" })],
    ["a 422 for another reason", new V3ApiError({ status: 422, detail: "", details: { reason: "other" } })],
    ["a server fault", new V3ApiError({ status: 500, detail: "" })],
    ["an error that isn't from the API", new Error("boom")],
  ])("answers null for %s, which the pending screen reports itself", (_label, error) => {
    expect(getInviteRefusalState(error)).toBeNull();
  });
});
