import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TV3SurveyTargeting } from "./schemas";

type TV3SurveyFilters = TV3SurveyTargeting["filters"];

/** Shared message for the (enterprise) contacts/targeting entitlement, thrown with caller-specific error classes. */
export const V3_CONTACTS_NOT_ENABLED_MESSAGE =
  "Contact targeting (segments) is not enabled for this organization. Upgrade to target app surveys by contact attributes.";

/**
 * Resolve whether contact targeting (the enterprise Contacts feature) is enabled for a workspace's
 * organization. Returns the resolved org id alongside the flag so each caller can throw its own typed
 * permission error (create vs patch surface differently). `resolvedOrganizationId` is null when the
 * organization cannot be resolved.
 */
export async function resolveV3ContactsEntitlement(
  workspaceId: string,
  organizationId?: string
): Promise<{ resolvedOrganizationId: string | null; isContactsEnabled: boolean }> {
  const resolvedOrganizationId =
    organizationId ?? (await getOrganizationByWorkspaceId(workspaceId))?.id ?? null;
  if (!resolvedOrganizationId) {
    return { resolvedOrganizationId: null, isContactsEnabled: false };
  }

  const isContactsEnabled = await getIsContactsEnabled(resolvedOrganizationId);
  return { resolvedOrganizationId, isContactsEnabled };
}

/**
 * Order-insensitive deep equality for JSON values. Object keys are compared by name (order does not
 * matter); arrays are compared positionally (filter order is meaningful). Used to detect whether a
 * patch actually changes the targeting filters so the contacts entitlement gate and segment write
 * only run on real changes.
 */
function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => jsonDeepEqual(item, b[index]));
  }
  if (typeof a === "object") {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every((key) => Object.hasOwn(bRecord, key) && jsonDeepEqual(aRecord[key], bRecord[key]));
  }
  return false;
}

export function areV3SurveyTargetingFiltersEqual(a: unknown, b: unknown): boolean {
  return jsonDeepEqual(a ?? [], b ?? []);
}

/**
 * Persist app-survey contact targeting onto the survey's (auto-created) segment. Writes the segment
 * row directly — mirroring updateSurveyInternal — so empty filters ("show to everyone") are supported,
 * which the EE updateSegment service rejects. Entitlement is gated by the caller before invoking this.
 *
 * Pass a transaction client (`tx`) to write atomically alongside the survey update; defaults to the
 * shared prisma client for standalone writes (e.g. on create).
 */
export async function setV3SurveySegmentFilters(
  segmentId: string,
  filters: TV3SurveyFilters,
  client: Prisma.TransactionClient = prisma
): Promise<void> {
  try {
    await client.segment.update({
      where: { id: segmentId },
      data: { filters },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
}
