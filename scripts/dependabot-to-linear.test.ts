import { describe, expect, test } from "vitest";
import { alertTitlePrefix, buildIssue } from "./dependabot-to-linear.mjs";

const alert = {
  number: 197,
  html_url: "https://github.com/formbricks/ee/security/dependabot/197",
  dependency: { package: { name: "undici", ecosystem: "npm" } },
  security_advisory: { summary: "undici DoS", ghsa_id: "GHSA-2m5v-pch6-74hx", cve_id: null },
  security_vulnerability: {
    severity: "high",
    vulnerable_version_range: ">= 4.0.0, < 6.29.1",
    first_patched_version: { identifier: "6.29.1" },
  },
};

describe("alert title prefix", () => {
  test("keeps the bare prefix formbricks/formbricks tickets were filed under", () => {
    expect(alertTitlePrefix("formbricks/formbricks", 926)).toBe("[Dependabot #926]");
  });

  test("names every other repository, so equal alert numbers don't collide", () => {
    expect(alertTitlePrefix("formbricks/ee", 926)).toBe("[Dependabot ee#926]");
    expect(alertTitlePrefix("formbricks/hub", 926)).not.toBe(alertTitlePrefix("formbricks/ee", 926));
  });

  test("a prefix is never a prefix of another alert's prefix", () => {
    // findIssue matches titles with startsWith, so #1 must not match #12.
    expect(alertTitlePrefix("formbricks/ee", 12).startsWith(alertTitlePrefix("formbricks/ee", 1))).toBe(
      false
    );
    expect(
      alertTitlePrefix("formbricks/ee", 1).startsWith(alertTitlePrefix("formbricks/formbricks", 1))
    ).toBe(false);
  });
});

describe("buildIssue", () => {
  test("titles and describes the alert with its repository", () => {
    const issue = buildIssue(alert, "formbricks/ee");

    expect(issue.titlePrefix).toBe("[Dependabot ee#197]");
    expect(issue.title).toBe("[Dependabot ee#197] undici — undici DoS");
    expect(issue.priority).toBe(2);
    expect(issue.description).toContain(`**Dependabot alert [formbricks/ee#197](${alert.html_url})**`);
    expect(issue.description).toContain("- **Repository:** `formbricks/ee`");
    expect(issue.description).toContain("- **Patched version:** 6.29.1");
  });
});
