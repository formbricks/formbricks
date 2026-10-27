import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  getRetentionErrorMessage,
  getRetentionExemptionCreateErrorMessage,
  getRetentionPolicySaveErrorMessage,
} from "./error-message";

const t = ((key: string) => key) as unknown as TFunction;

const problem = (status: number, code?: string) =>
  new V3ApiError({ status, detail: "English text from the server", code });

describe("getRetentionErrorMessage", () => {
  test("translates data retention's own problem codes", () => {
    expect(getRetentionErrorMessage(problem(422, "retention_exemption_exists"), t, "fallback")).toBe(
      "workspace.settings.data_retention.exemption_exists"
    );
    expect(getRetentionErrorMessage(problem(422, "retention_exemption_not_active"), t, "fallback")).toBe(
      "workspace.settings.data_retention.exemption_not_active"
    );
    expect(getRetentionErrorMessage(problem(422, "retention_export_too_large"), t, "fallback")).toBe(
      "workspace.settings.data_retention.export_too_large"
    );
  });

  test("says to try again later on a rate limit", () => {
    expect(getRetentionErrorMessage(problem(429, "too_many_requests"), t, "fallback")).toBe(
      "common.error_rate_limit_description"
    );
  });

  test("falls back for any other problem, a timeout or a network failure, never showing their text", () => {
    expect(getRetentionErrorMessage(problem(403, "forbidden"), t, "fallback")).toBe("fallback");
    expect(getRetentionErrorMessage(problem(500), t, "fallback")).toBe("fallback");
    expect(
      getRetentionErrorMessage(new DOMException("The operation timed out.", "TimeoutError"), t, "fallback")
    ).toBe("fallback");
    expect(getRetentionErrorMessage(new TypeError("Failed to fetch"), t, "fallback")).toBe("fallback");
    expect(getRetentionErrorMessage(undefined, t, "fallback")).toBe("fallback");
  });
});

describe("getRetentionPolicySaveErrorMessage", () => {
  test("reports a policy the server found invalid as one translated message", () => {
    expect(getRetentionPolicySaveErrorMessage(problem(422, "unprocessable_content"), t)).toBe(
      "workspace.settings.data_retention.policy_invalid"
    );
  });

  test("otherwise reads the shared codes, then falls back to the save failure", () => {
    expect(getRetentionPolicySaveErrorMessage(problem(429, "too_many_requests"), t)).toBe(
      "common.error_rate_limit_description"
    );
    expect(getRetentionPolicySaveErrorMessage(problem(403, "forbidden"), t)).toBe(
      "workspace.settings.data_retention.policy_save_failed"
    );
    expect(getRetentionPolicySaveErrorMessage(new Error("boom"), t)).toBe(
      "workspace.settings.data_retention.policy_save_failed"
    );
  });
});

describe("getRetentionExemptionCreateErrorMessage", () => {
  test("asks to check the end date when the server refuses it", () => {
    expect(getRetentionExemptionCreateErrorMessage(problem(422, "unprocessable_content"), t)).toBe(
      "workspace.settings.data_retention.exemption_until_invalid"
    );
  });

  test("otherwise reads the shared codes, then falls back to the create failure", () => {
    expect(getRetentionExemptionCreateErrorMessage(problem(422, "retention_exemption_exists"), t)).toBe(
      "workspace.settings.data_retention.exemption_exists"
    );
    expect(getRetentionExemptionCreateErrorMessage(problem(500), t)).toBe(
      "workspace.settings.data_retention.exemption_create_failed"
    );
  });
});
