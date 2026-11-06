import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getSurveyIdsReadBySegments } from "@/modules/ee/contacts/segments/lib/helper";
import {
  ALL_SEGMENT_SURVEY_REFS,
  getExistingWorkspaceSurveyIds,
  getSegments,
} from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3SurveyTargeting } from "./schemas";
import {
  type TV3TargetingFilterReference,
  V3_TARGETING_DEVICE_VALUES,
  collectV3TargetingFilterReferences,
} from "./targeting-references";

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

/**
 * The `invalid_reference` params for targeting filters that nest a segment: one that is not this
 * workspace's, or (ENG-6870) one whose own filters read a survey the caller cannot see — a nested segment
 * reads the surveys it names, so they are held to the same visibility as a survey named directly. A survey
 * that no longer exists reads nothing. One existence/visibility lookup pair covers every reference.
 */
async function getV3SegmentReferenceIssues(
  segmentRefs: TV3TargetingFilterReference[],
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput
): Promise<InvalidParam[]> {
  const issues: InvalidParam[] = [];
  const issue = (reference: TV3TargetingFilterReference, reason: string): InvalidParam => ({
    name: reference.path,
    reason,
    code: "invalid_reference",
    identifier: reference.value,
  });

  // Scope to the workspace's own segments — `getSegment(id)` is global, so a bare existence check
  // would accept (and store) a reference to another workspace's segment.
  const segments = await getSegments(workspaceId, ALL_SEGMENT_SURVEY_REFS);
  const segmentsById = new Map(segments.map((segment) => [segment.id, segment]));
  for (const reference of segmentRefs.filter((ref) => !segmentsById.has(ref.value))) {
    issues.push(issue(reference, `Segment '${reference.value}' was not found in this workspace`));
  }

  const referencedSegments = segments.filter((candidate) =>
    segmentRefs.some((ref) => ref.value === candidate.id)
  );
  const readSurveyIds = [...(await getSurveyIdsReadBySegments(referencedSegments, workspaceId))];
  if (readSurveyIds.length === 0) return issues;

  const [existing, visible] = await Promise.all([
    getExistingWorkspaceSurveyIds(workspaceId, readSurveyIds, {}),
    getExistingWorkspaceSurveyIds(workspaceId, readSurveyIds, visibleSurveyWhere),
  ]);
  const hidden = new Set(
    readSurveyIds.filter((surveyId) => existing.has(surveyId) && !visible.has(surveyId))
  );
  if (hidden.size === 0) return issues;

  // Only on refusal: walk each referenced segment on its own to name the ones that read a hidden survey.
  for (const segment of referencedSegments) {
    const read = await getSurveyIdsReadBySegments([segment], workspaceId); // NOSONAR
    if (![...read].some((surveyId) => hidden.has(surveyId))) continue;
    for (const reference of segmentRefs.filter((ref) => ref.value === segment.id)) {
      issues.push(
        issue(reference, `Segment '${reference.value}' filters on a survey you don't have access to`)
      );
    }
  }
  return issues;
}

/**
 * Validate that every app-survey targeting filter can resolve — contact-attribute keys (incl. the
 * "userId" person identifier) and referenced segments must exist in the workspace, unsupported person
 * identifiers are rejected, and device values must be a known device. Mirrors trigger action-class
 * validation (see resolveV3SurveyTriggers): each problem becomes a structured `invalid_reference` param
 * the v3 layer maps to a 422. Workspace lookups are skipped when no filter needs them.
 *
 * `tx`, when the write runs inside a caller's transaction (ENG-6845), is where the attribute keys are
 * read from: an import creates the keys its targeting names in that transaction, before this check.
 */
export async function assertV3SurveyTargetingFilterReferences(
  workspaceId: string,
  filters: TV3SurveyFilters,
  visibleSurveyWhere: Prisma.SurveyWhereInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const references = collectV3TargetingFilterReferences(filters, "targeting.filters");

  if (references.length === 0) {
    return;
  }

  const invalidParams: InvalidParam[] = [];

  // Static rejections that can never match — no workspace lookup needed.
  for (const reference of references.filter((ref) => ref.kind === "unsupportedPersonIdentifier")) {
    invalidParams.push({
      name: reference.path,
      reason: `Unsupported person identifier '${reference.value}'; only 'userId' is supported`,
      code: "invalid_reference",
      identifier: reference.value,
    });
  }
  for (const reference of references.filter((ref) => ref.kind === "invalidDeviceValue")) {
    invalidParams.push({
      name: reference.path,
      reason: `Unsupported device '${reference.value}'; expected one of: ${V3_TARGETING_DEVICE_VALUES.join(", ")}`,
      code: "invalid_reference",
      identifier: reference.value,
    });
  }

  const attributeKeyRefs = references.filter((ref) => ref.kind === "attributeKey");
  if (attributeKeyRefs.length > 0) {
    const attributeKeys = tx
      ? await tx.contactAttributeKey.findMany({ where: { workspaceId }, select: { key: true } })
      : await getContactAttributeKeys(workspaceId);
    const knownKeys = new Set(attributeKeys.map((attributeKey) => attributeKey.key));
    for (const reference of attributeKeyRefs.filter((ref) => !knownKeys.has(ref.value))) {
      invalidParams.push({
        name: reference.path,
        reason: `Contact attribute key '${reference.value}' was not found in this workspace`,
        code: "invalid_reference",
        identifier: reference.value,
      });
    }
  }

  const segmentRefs = references.filter((ref) => ref.kind === "segment");
  if (segmentRefs.length > 0) {
    invalidParams.push(...(await getV3SegmentReferenceIssues(segmentRefs, workspaceId, visibleSurveyWhere)));
  }

  const surveyRefs = references.filter((ref) => ref.kind === "survey");
  if (surveyRefs.length > 0) {
    // Scope to the workspace's own surveys so a survey-interaction filter cannot reference another
    // workspace's survey. Look up by the exact referenced ids (not the picker's bounded recent list)
    // so a valid survey in a large workspace isn't wrongly rejected for being outside that window.
    // ENG-3282: and only surveys the caller may see. A restricted survey they cannot read answers
    // exactly like an unknown id, so the response never reveals that it exists.
    const knownSurveyIds = await getExistingWorkspaceSurveyIds(
      workspaceId,
      surveyRefs.map((ref) => ref.value),
      visibleSurveyWhere
    );
    for (const reference of surveyRefs.filter((ref) => !knownSurveyIds.has(ref.value))) {
      invalidParams.push({
        name: reference.path,
        reason: `Survey '${reference.value}' was not found in this workspace`,
        code: "invalid_reference",
        identifier: reference.value,
      });
    }
  }

  if (invalidParams.length > 0) {
    throw new V3SurveyReferenceValidationError(invalidParams);
  }
}
