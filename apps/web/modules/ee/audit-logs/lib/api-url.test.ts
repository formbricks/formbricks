import { describe, expect, test } from "vitest";
import { V3_SURVEY_CREATED_FROM } from "@/app/api/v3/surveys/schemas";
import { ALLOWED_QUERY_VALUE, sanitizeAuditApiUrl } from "./api-url";

describe("sanitizeAuditApiUrl", () => {
  test("keeps origin and path and drops every query parameter outside the allowlist", () => {
    expect(
      sanitizeAuditApiUrl("https://app.example.com/api/v1/management/responses?surveyId=s1&token=t")
    ).toBe("https://app.example.com/api/v1/management/responses");
  });

  test.each(["blank", "template", "xm-template", "ai", "import"])("keeps createdFrom=%s", (createdFrom) => {
    expect(sanitizeAuditApiUrl(`https://app.example.com/api/v3/surveys?createdFrom=${createdFrom}`)).toBe(
      `https://app.example.com/api/v3/surveys?createdFrom=${createdFrom}`
    );
  });

  test("accepts every createdFrom value the v3 survey create schema allows", () => {
    // The audit builder checks the value's shape instead of importing the v3 survey schemas; this keeps
    // a new enum value from silently dropping out of the audit trail.
    expect(V3_SURVEY_CREATED_FROM.every((value) => ALLOWED_QUERY_VALUE.test(value))).toBe(true);
  });

  test("drops a createdFrom value that is not a short slug", () => {
    expect(sanitizeAuditApiUrl("https://app.example.com/api/v3/surveys?createdFrom=jane%40example.com")).toBe(
      "https://app.example.com/api/v3/surveys"
    );
  });

  test("drops credentials and fragments carried in the URL itself", () => {
    expect(sanitizeAuditApiUrl("https://user:pass@app.example.com/api/test#access_token=t")).toBe(
      "https://app.example.com/api/test"
    );
  });

  test("replaces the storage file path with a placeholder, keeping workspace and access type", () => {
    expect(sanitizeAuditApiUrl("https://app.example.com/storage/ws1/public/a/b/my%20file.pdf")).toBe(
      "https://app.example.com/storage/ws1/public/redacted"
    );
  });

  test.each(["/custom-path", "/a/b"])("finds the storage route behind BASE_PATH %s", (basePath) => {
    expect(
      sanitizeAuditApiUrl(`https://host.example.com${basePath}/storage/ws1/private/jane-passport.pdf?x=1`)
    ).toBe(`https://host.example.com${basePath}/storage/ws1/private/redacted`);
  });

  test("leaves a storage path with no file segment unchanged", () => {
    expect(sanitizeAuditApiUrl("https://app.example.com/storage/ws1/private")).toBe(
      "https://app.example.com/storage/ws1/private"
    );
  });

  test.each([undefined, "", "/api/relative", "not a url", "mailto:jane@example.com"])(
    "returns undefined for %s",
    (value) => {
      expect(sanitizeAuditApiUrl(value)).toBeUndefined();
    }
  );
});
