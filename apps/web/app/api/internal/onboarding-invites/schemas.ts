import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZUserEmail, ZUserName } from "@formbricks/types/user";

/** `POST /api/internal/onboarding-invites`: one teammate invited from the setup screen. */
export const ZOnboardingInviteBody = z
  .object({ organizationId: ZId, email: ZUserEmail, name: ZUserName })
  .strict();

export type TOnboardingInviteBody = z.infer<typeof ZOnboardingInviteBody>;
