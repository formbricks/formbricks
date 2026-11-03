import { describe, expect, test, vi } from "vitest";
import {
  alertTitlePrefix,
  buildIssue,
  findSiblingIssues,
  isRepositoryName,
} from "./dependabot-to-linear.mjs";

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

  test("cross-references the siblings already filed for the same advisory", () => {
    const issue = buildIssue(alert, "formbricks/hub", [
      {
        identifier: "ENG-1234",
        url: "https://linear.app/formbricks/issue/ENG-1234",
        title: "[Dependabot ee#199] glob — glob command injection",
      },
      {
        identifier: "ENG-1230",
        url: "https://linear.app/formbricks/issue/ENG-1230",
        title: "[Dependabot #984] glob — glob command injection",
      },
    ]);

    expect(issue.description).toContain(
      "- **Also tracked as:** [ENG-1234](https://linear.app/formbricks/issue/ENG-1234) (ee#199), " +
        "[ENG-1230](https://linear.app/formbricks/issue/ENG-1230) (formbricks#984)"
    );
  });

  test("omits the cross-reference when no sibling exists", () => {
    expect(buildIssue(alert, "formbricks/ee").description).not.toContain("Also tracked as");
    expect(buildIssue(alert, "formbricks/ee", []).description).not.toContain("Also tracked as");
  });
});

describe("isRepositoryName", () => {
  test("accepts the owner/repo names GitHub hands out", () => {
    expect(isRepositoryName("formbricks/formbricks")).toBe(true);
    expect(isRepositoryName("formbricks/ee")).toBe(true);
    expect(isRepositoryName("foo-org/bar.js_v2")).toBe(true);
  });

  test("rejects names of another shape", () => {
    expect(isRepositoryName("formbricks")).toBe(false);
    expect(isRepositoryName("formbricks/ee/hub")).toBe(false);
    expect(isRepositoryName("/ee")).toBe(false);
    expect(isRepositoryName("ee/")).toBe(false);
    expect(isRepositoryName("")).toBe(false);
    expect(isRepositoryName("form bricks/ee")).toBe(false);
  });

  test("rejects dot segments, which would climb out of the API path", () => {
    expect(isRepositoryName("../ee")).toBe(false);
    expect(isRepositoryName("formbricks/..")).toBe(false);
    expect(isRepositoryName(".")).toBe(false);
    expect(isRepositoryName("./ee")).toBe(false);
  });
});

describe("findSiblingIssues", () => {
  const stub = (...nodes: unknown[]) => vi.fn(async () => ({ issues: { nodes } }));

  test("keeps Dependabot tickets for the advisory, minus this repository's own", async () => {
    const siblings = await findSiblingIssues("key", "GHSA-2m5v-pch6-74hx", {
      excludePrefix: "[Dependabot ee#197]",
      request: stub(
        { identifier: "ENG-1", title: "[Hand-written] same GHSA pasted in a description", url: "u1" },
        { identifier: "ENG-2", title: "[Dependabot #984] glob — injection", url: "u2" },
        { identifier: "ENG-3", title: "[Dependabot ee#197] undici — undici DoS", url: "u3" },
        { identifier: "ENG-4", title: "[Dependabot hub#7] glob — injection", url: "u4" }
      ),
    });

    expect(siblings.map((issue: { identifier: string }) => issue.identifier)).toEqual(["ENG-2", "ENG-4"]);
  });

  test("returns nothing for an alert without an advisory id", async () => {
    const request = stub();
    expect(await findSiblingIssues("key", "", { request })).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  test("survives a failing lookup rather than losing the ticket", async () => {
    const request = vi.fn(async () => {
      throw new Error("Linear API error: boom");
    });
    await expect(findSiblingIssues("key", "GHSA-2m5v-pch6-74hx", { request })).resolves.toEqual([]);
  });
});
