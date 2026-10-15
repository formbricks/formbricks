import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getReactivateMemberErrorMessage } from "./reactivate-member-error";

const t = ((key: string) => key) as unknown as TFunction;

const problem = (status: number, code?: string) =>
  new V3ApiError({ status, detail: "English text from the server", code });

describe("getReactivateMemberErrorMessage", () => {
  test("explains why a member of another organization can't be reactivated", () => {
    expect(getReactivateMemberErrorMessage(problem(422, "member_in_other_organizations"), t)).toBe(
      "workspace.settings.data_retention.reactivate_member_in_other_organizations"
    );
  });

  test("says to try again later on a rate limit", () => {
    expect(getReactivateMemberErrorMessage(problem(429, "too_many_requests"), t)).toBe(
      "common.error_rate_limit_description"
    );
  });

  test("falls back to the generic failure, never the server's or the timeout's text", () => {
    const fallback = "workspace.settings.data_retention.reactivate_failed";
    expect(getReactivateMemberErrorMessage(problem(403, "forbidden"), t)).toBe(fallback);
    expect(getReactivateMemberErrorMessage(problem(500), t)).toBe(fallback);
    expect(
      getReactivateMemberErrorMessage(new DOMException("The operation timed out.", "TimeoutError"), t)
    ).toBe(fallback);
  });
});
