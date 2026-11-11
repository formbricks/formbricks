import "server-only";
import { z } from "zod";
import type { TOrganization } from "@formbricks/types/organizations";
import { type TOrgAction, requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { refusalResponse } from "@/app/api/internal/lib/refusal";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { problemBadRequest, problemConflict, problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganization } from "@/lib/organization/service";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  BILLING_CHANGE_LOCK_TTL_MS,
  BILLING_CHANGE_LOCK_WAIT_MS,
  withOrganizationBillingLock,
} from "@/modules/ee/billing/lib/billing-lock";

export type TBillingRequestContext = {
  authentication: TV3Authentication;
  organizationId: string;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * Authorize a billing request on one organization, as the server action it replaces did (`action`:
 * `organization.manage_billing`, or `organization.manage` for the onboarding plan choice), then charge the
 * organization's state-mutation budget for a write. The audit entry names the organization before anything
 * can refuse, so a refusal's entry says what was attempted, as the actions' entries did.
 */
export async function requireBillingAccess(
  context: TBillingRequestContext,
  { action, chargeStateMutation }: { action: TOrgAction; chargeStateMutation: boolean }
): Promise<Response | { userId: string }> {
  const { organizationId, requestId, instance, auditLog } = context;
  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = organizationId;
  }

  const access = await requireOrgActionAccess({ ...context, action });
  if (access instanceof Response) return access;

  if (chargeStateMutation) {
    const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, organizationId, {
      requestId,
      instance,
    });
    if (limited) return limited;
  }

  return access;
}

/**
 * The organization and its Stripe customer, or the uniform 403 for an organization that is gone or has no
 * Stripe customer yet: the server actions threw `ResourceNotFoundError` for both, which the page showed as
 * its generic error.
 */
export async function getBillingCustomerOrRefuse({
  organizationId,
  requestId,
  instance,
}: TBillingRequestContext): Promise<Response | { organization: TOrganization; customerId: string }> {
  const organization = await getOrganization(organizationId);
  const customerId = organization?.billing.stripeCustomerId;
  if (!organization || !customerId) return problemForbidden(requestId, undefined, instance);
  return { organization, customerId };
}

/**
 * Run a billing step; a refusal the billing service throws (`OperationNotAllowedError` with the reason the
 * page translates, such as `payment_method_required`; `ResourceNotFoundError`) answers as `refusalResponse`
 * maps it. Anything else propagates to the wrapper.
 */
export async function answerRefusals(
  { requestId, instance }: TBillingRequestContext,
  step: () => Promise<Response>
): Promise<Response> {
  try {
    return await step();
  } catch (error) {
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    throw error;
  }
}

export const BILLING_CHANGE_IN_PROGRESS_DETAIL =
  "Another billing change for this organization is in progress. Try again in a moment.";

/**
 * Run `work` holding the organization's billing lock (`billing-lock.ts`), so it never runs beside another
 * plan change or a Stripe sync of the same organization. A 409 when another holder keeps the lock for the
 * whole wait.
 */
export async function runHoldingBillingLock(
  { organizationId, requestId, instance }: TBillingRequestContext,
  work: () => Promise<Response>
): Promise<Response> {
  const result = await withOrganizationBillingLock(organizationId, work, {
    ttlMs: BILLING_CHANGE_LOCK_TTL_MS,
    waitMs: BILLING_CHANGE_LOCK_WAIT_MS,
  });
  return result.ran ? result.value : problemConflict(requestId, BILLING_CHANGE_IN_PROGRESS_DETAIL, instance);
}

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Longest header value read: a UUID, quoted as a Structured Field string, with room to spare. */
const IDEMPOTENCY_KEY_HEADER_MAX = 64;

const ZIntentKey = z.uuid();

/**
 * The `Idempotency-Key` header: the UUID the billing page draws for one user intent (one click that
 * starts a checkout or a plan change), as a Structured Field string (`"…"`) or bare. `null` when it is
 * missing or not a UUID.
 */
export const parseIntentKey = (header: string | null): string | null => {
  if (header === null || header.length > IDEMPOTENCY_KEY_HEADER_MAX) return null;
  const trimmed = header.trim();
  const key =
    trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
  return ZIntentKey.safeParse(key).success ? key.toLowerCase() : null;
};

/**
 * The Stripe idempotency key for an intent's writes: the operation and the organization ahead of the
 * caller's UUID, so a key only ever replays the same operation on the same organization, never another
 * tenant's Stripe answer. The billing service appends each write's step.
 */
export const stripeIntentKey = (operation: string, organizationId: string, intentKey: string): string =>
  `${operation}:${organizationId}:${intentKey}`;

/**
 * The intent key a Stripe-writing route requires, or the 400 when it is missing or not a UUID. Read before
 * the caller is authorized, like the body the wrapper parses first.
 */
export const requireIntentKey = (
  req: Request,
  { requestId, instance }: TBillingRequestContext
): string | Response =>
  parseIntentKey(req.headers.get(IDEMPOTENCY_KEY_HEADER)) ??
  problemBadRequest(requestId, "An Idempotency-Key header is required", {
    instance,
    invalid_params: [{ name: IDEMPOTENCY_KEY_HEADER, reason: "Expected a UUID" }],
  });
