import type { TProfilePatchBody } from "@/app/api/internal/users/me/schemas";
import type { TProfileResource } from "@/app/api/internal/users/me/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const BASE_PATH = "/api/internal/users/me";

/** Change your own name, locale or email address. An email change needs `password`. */
export const updateProfile = (body: TProfilePatchBody) =>
  sendApiRequest<TProfileResource>(BASE_PATH, { method: "PATCH", body });

/** Email yourself a password reset link. */
export const requestPasswordReset = () =>
  sendApiRequest<{ emailSent: true }>(`${BASE_PATH}/password-resets`, { method: "POST" });

/** Email an SSO account the link that confirms deleting it. */
export const requestAccountDeletionEmail = () =>
  sendApiRequest<{ emailSent: true }>(`${BASE_PATH}/deletion-requests`, { method: "POST" });
