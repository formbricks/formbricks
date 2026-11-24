import { describe, expect, test } from "vitest";
import { sanitizeAuditApiUrl } from "./api-url";

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

  test.each([undefined, "", "/api/relative", "not a url", "mailto:jane@example.com"])(
    "returns undefined for %s",
    (value) => {
      expect(sanitizeAuditApiUrl(value)).toBeUndefined();
    }
  );
});
