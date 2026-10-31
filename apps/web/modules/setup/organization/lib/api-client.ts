import type { TCreatedOrganizationResource } from "@/app/api/internal/organizations/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

/** Client fetchers for the onboarding screens. Each throws a `V3ApiError` on a refusal. */

/** Set up a new organization, with the caller as its owner and a first workspace. */
export const createOrganization = (name: string) =>
  sendApiRequest<TCreatedOrganizationResource>("/api/internal/organizations", {
    method: "POST",
    body: { name },
  });

/** Invite one teammate as an owner, from the setup screen. */
export const inviteOnboardingMember = (invite: { organizationId: string; email: string; name: string }) =>
  sendApiRequest<{ id: string }>("/api/internal/onboarding-invites", { method: "POST", body: invite });
