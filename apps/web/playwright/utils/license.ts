import { type APIRequestContext, expect } from "@playwright/test";

/**
 * Whether the instance's Enterprise license includes Creatives (ENG-6602), for a journey that needs
 * them to decide before it starts rather than fail several steps later on UI that never renders.
 *
 * The probe is listing the workspace's creatives through API v3 with the caller's session: it answers
 * 403 `creatives_not_entitled` when the license lacks Creatives (or on Formbricks Cloud), and 200 when it
 * has them; anything else fails the journey. Call it on a workspace with no creatives: a license that
 * lost Creatives still lets a workspace that has some list them (wind-down), so only an empty workspace
 * makes the answer conclusive.
 */
export const hasCreativesLicense = async (
  request: APIRequestContext,
  workspaceId: string
): Promise<boolean> => {
  const response = await request.get("/api/v3/creatives", { params: { workspaceId } });

  if (response.status() === 403) {
    const problem = (await response.json().catch(() => null)) as { code?: string } | null;
    if (problem?.code === "creatives_not_entitled") return false;
  }

  expect(response.status(), `listing creatives to check the license: ${await response.text()}`).toBe(200);
  return true;
};

/**
 * Whether the instance's Enterprise license includes Workflows, for the Workflows journey to decide
 * before it starts.
 *
 * The probe is listing the workspace's workflows through API v3 with the session of the workspace's
 * owner: every workflow route answers 403 "Workflows are not enabled for this organization" when the
 * license lacks the `workflows` feature (`buildWorkflowApiContext`), and 200 when it has it. Anything
 * else, another 403 included, fails the journey with the response body.
 */
export const hasWorkflowsLicense = async (
  request: APIRequestContext,
  workspaceId: string
): Promise<boolean> => {
  const response = await request.get("/api/v3/workflows", { params: { workspaceId, limit: 1 } });

  // Only the entitlement gate's 403 means "no Workflows" (`buildWorkflowApiContext`). Any other 403
  // (workspace access) fails with its body, so a run says which check refused.
  if (response.status() === 403) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
    if (problem?.detail === "Workflows are not enabled for this organization") return false;
  }

  expect(response.status(), `listing workflows to check the license: ${await response.text()}`).toBe(200);
  return true;
};
