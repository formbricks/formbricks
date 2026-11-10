import "server-only";
import { InvalidInputError, TooManyRequestsError } from "@formbricks/types/errors";
import { rateLimitedResponse } from "@/app/api/v3/lib/operation-rate-limit";
import {
  problemBadGateway,
  problemForbidden,
  problemUnauthorized,
  successResponse,
} from "@/app/api/v3/lib/response";
import { getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { sendEmailCustomizationPreviewEmail } from "@/modules/email";
import { type TWhiteLabelRequestContext, requireWhiteLabelOrgAccess } from "../../lib/whitelabel-access";

/**
 * `POST /api/internal/organizations/{organizationId}/test-emails`: email the caller a preview of the
 * organization's customized email, with its saved logo. Owners and managers, where the licence includes
 * whitelabelling. Rate-limited per sender by the email service itself (and by the wrapper per user), as
 * the server action it replaces was. Not audited: it changes nothing.
 *
 * 202 with whether an email went out: none does on an instance without SMTP, which the page has always
 * reported as sent.
 */
export async function sendTestEmailOperation(context: TWhiteLabelRequestContext): Promise<Response> {
  const { organizationId, requestId, instance } = context;
  const access = await requireWhiteLabelOrgAccess(context, { chargeStateMutation: false });
  if (access instanceof Response) return access;

  const [organization, user] = await Promise.all([getOrganization(organizationId), getUser(access.userId)]);
  // Gone between the check and the read: the same 403 as an organization the caller can't see.
  if (!organization) return problemForbidden(requestId, undefined, instance);
  if (!user) return problemUnauthorized(requestId, "Session required", instance);

  let emailSent: boolean;
  try {
    emailSent = await sendEmailCustomizationPreviewEmail(
      user.email,
      user.name,
      user.locale,
      user.id,
      organization.whitelabel?.logoUrl || "",
      organization.id
    );
  } catch (error) {
    // The sender's email budget is spent: the limiter's message, which says when to try again.
    if (error instanceof TooManyRequestsError) return rateLimitedResponse(error, { requestId, instance });
    // The SMTP server refused the message ("Incorrect SMTP credentials"), which the page shows.
    if (error instanceof InvalidInputError) return problemBadGateway(requestId, error.message, instance);
    throw error;
  }

  return successResponse({ emailSent }, { requestId, status: 202 });
}
