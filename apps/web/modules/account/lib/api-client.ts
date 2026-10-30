import type { TProfilePatchBody } from "@/app/api/internal/users/me/schemas";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/users/me";

/**
 * Change your own name, locale or email address. An email change needs `password`; whether it took effect
 * is deliberately not reported (see the route), so reload the page to show the stored profile.
 */
export const updateProfile = (body: TProfilePatchBody) =>
  sendApiRequest<void>(BASE_PATH, { method: "PATCH", body });

/** Email yourself a password reset link. */
export const requestPasswordReset = () =>
  sendApiRequest<{ emailSent: true }>(`${BASE_PATH}/password-resets`, { method: "POST" });

/** Email an SSO account the link that confirms deleting it. */
export const requestAccountDeletionEmail = () =>
  sendApiRequest<{ emailSent: true }>(`${BASE_PATH}/deletion-requests`, { method: "POST" });
