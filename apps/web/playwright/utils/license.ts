import { type APIRequestContext, expect } from "@playwright/test";

/**
 * Fails, rather than skips, a journey that needs Creatives on an instance whose Enterprise license
 * doesn't include them (ENG-6602). Without the `creatives` flag the journey would otherwise fail several
 * steps later on UI that never renders, which reads like a regression in Creatives itself.
 *
 * The probe is listing the workspace's creatives through API v3 with the caller's session: it answers
 * 403 `creatives_not_entitled` when the license lacks Creatives (or on Formbricks Cloud), and 200 when it
 * has them. Call it on a workspace with no creatives: a license that lost Creatives still lets a
 * workspace that has some list them (wind-down), so only an empty workspace makes the answer conclusive.
 */
export const requireCreativesLicense = async (
  request: APIRequestContext,
  workspaceId: string
): Promise<void> => {
  const response = await request.get("/api/v3/creatives", { params: { workspaceId } });

  if (response.status() === 403) {
    const problem = (await response.json().catch(() => null)) as { code?: string; detail?: string } | null;
    if (problem?.code === "creatives_not_entitled") {
      throw new Error(
        "The instance's Enterprise license doesn't include Creatives; this journey needs a license with " +
          `\`creatives\` (API v3 answered 403 creatives_not_entitled: "${problem.detail ?? ""}")`
      );
    }
  }

  expect(response.status(), `listing creatives to check the license: ${await response.text()}`).toBe(200);
};
