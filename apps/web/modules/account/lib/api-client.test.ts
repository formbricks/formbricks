import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { recheckLicense } from "@/modules/ee/license-check/lib/api-client";
import { inviteOnboardingMember } from "@/modules/setup/organization/lib/api-client";
import { requestAccountDeletionEmail, requestPasswordReset, updateProfile } from "./api-client";

// These writes send an email or wait on the license server before answering. A client timeout would
// report a failure for work that still lands, and a retry would repeat it, so none of them set one.
describe("writes that do slow outbound work carry no client timeout", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test.each([
    {
      name: "profile update",
      route: "PATCH /api/internal/users/me",
      call: () => updateProfile({ email: "new@example.com", password: "secret" }),
      response: () => new Response(null, { status: 204 }),
    },
    {
      name: "password reset email",
      route: "POST /api/internal/users/me/password-resets",
      call: requestPasswordReset,
      response: () => json({ data: { emailSent: true } }),
    },
    {
      name: "account deletion email",
      route: "POST /api/internal/users/me/deletion-requests",
      call: requestAccountDeletionEmail,
      response: () => json({ data: { emailSent: true } }),
    },
    {
      name: "license recheck",
      route: "POST /api/internal/license-checks?workspaceId=clws111111111111111111111",
      call: () => recheckLicense("clws111111111111111111111"),
      response: () => json({ data: { status: "active" } }),
    },
    {
      name: "onboarding invite",
      route: "POST /api/internal/onboarding-invites",
      call: () =>
        inviteOnboardingMember({ organizationId: "clorg11111111111111111111", email: "a@b.co", name: "A" }),
      response: () => json({ data: { id: "clinv11111111111111111111" } }, 201),
    },
  ])("$name", async ({ route, call, response }) => {
    routeFetch({ [route]: [response()] });
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await call();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(timeout).not.toHaveBeenCalled();
  });
});
