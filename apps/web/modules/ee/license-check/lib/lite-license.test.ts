import { describe, expect, test } from "vitest";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, getLiteLicenseRequestUrl } from "./lite-license";

describe("getLiteLicenseRequestUrl", () => {
  test("requests a lite license and tags the touchpoint that sent it", () => {
    const url = new URL(getLiteLicenseRequestUrl("two_factor_auth"));

    expect(url.searchParams.get("type")).toBe("lite");
    expect(url.searchParams.get("feature")).toBe("two_factor_auth");
  });

  test("keeps the base form's other params", () => {
    const base = new URL(ENTERPRISE_LICENSE_REQUEST_FORM_URL);
    const url = new URL(getLiteLicenseRequestUrl("workspaces"));

    expect(url.origin + url.pathname).toBe(base.origin + base.pathname);
    expect(url.searchParams.get("delivery")).toBe("onpremise");
    expect(url.searchParams.get("source")).toBe("ce");
  });
});
