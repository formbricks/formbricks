import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import type {
  TSegmentAttributeFilter,
  TSegmentDeviceFilter,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
  TSegmentSurveyInteractionFilter,
} from "@formbricks/types/segment";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getSegments, getSurveyRefsForWorkspace } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { V3SurveyReferenceValidationError } from "./reference-validation";
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

// Allowed device-filter values; the evaluator compares the contact's runtime device against the
// filter's `value`, so any other value can never match.
const V3_TARGETING_DEVICE_VALUES = ["phone", "desktop"] as const;

// What a targeting leaf filter must satisfy to be valid, tagged by kind. `attributeKey` covers
// `attribute` filters AND `person` filters (personIdentifier "userId" resolves to the "userId"
// attribute key at evaluation time); `segment` covers segment-membership filters. The remaining kinds
// are static rejections that need no workspace lookup: `unsupportedPersonIdentifier` (a person filter
// whose identifier can never match) and `invalidDeviceValue` (a device filter whose value isn't a
// known device).
type TV3TargetingFilterReference = {
  kind: "attributeKey" | "segment" | "survey" | "unsupportedPersonIdentifier" | "invalidDeviceValue";
  value: string;
  path: string;
};

/**
 * Walk the (possibly nested) targeting filter tree once and return everything a leaf filter must
 * satisfy to be valid, tagged by kind, each with its JSON path so issues can be reported per-filter.
 */
function collectV3TargetingFilterReferences(
  filters: TV3SurveyFilters,
  basePath: string
): TV3TargetingFilterReference[] {
  return filters.flatMap((node, index) => {
    const resourcePath = `${basePath}.${index}.resource`;
    const { resource } = node;

    // A node's resource is either a nested filter group or a single leaf condition.
    if (Array.isArray(resource)) {
      return collectV3TargetingFilterReferences(resource, resourcePath);
    }

    // root.type is a nested discriminant TS doesn't narrow on; cast as the segment-filter consumers do.
    const rootPath = `${resourcePath}.root`;
    switch (resource.root.type) {
      case "attribute":
        return [
          {
            kind: "attributeKey" as const,
            value: (resource as TSegmentAttributeFilter).root.contactAttributeKey,
            path: `${rootPath}.contactAttributeKey`,
          },
        ];
      case "person": {
        // Only "userId" resolves (to the "userId" attribute key); any other identifier silently
        // matches nothing at evaluation time, so reject it instead of persisting a dead filter.
        const { personIdentifier } = (resource as TSegmentPersonFilter).root;
        return [
          {
            kind:
              personIdentifier === "userId"
                ? ("attributeKey" as const)
                : ("unsupportedPersonIdentifier" as const),
            value: personIdentifier,
            path: `${rootPath}.personIdentifier`,
          },
        ];
      }
      case "segment":
        return [
          {
            kind: "segment" as const,
            value: (resource as TSegmentSegmentFilter).root.segmentId,
            path: `${rootPath}.segmentId`,
          },
        ];
      case "device": {
        // The evaluator matches on `value`; `root.deviceType` is the field the spec presents (the UI
        // keeps the two in sync). Validate BOTH against the known devices so neither can hold garbage.
        // value can be a number/tuple via the shared schema; stringify for the message.
        const deviceFilter = resource as TSegmentDeviceFilter;
        // Widen to unknown[] so includes() accepts the unknown candidate (value may be a number/tuple);
        // a non-matching candidate just returns false, same as the prior per-element === check.
        const isKnownDevice = (candidate: unknown): boolean =>
          (V3_TARGETING_DEVICE_VALUES as readonly unknown[]).includes(candidate);
        const deviceIssues: (TV3TargetingFilterReference | null)[] = [
          isKnownDevice(deviceFilter.value)
            ? null
            : {
                kind: "invalidDeviceValue",
                value:
                  typeof deviceFilter.value === "string"
                    ? deviceFilter.value
                    : JSON.stringify(deviceFilter.value),
                path: `${resourcePath}.value`,
              },
          isKnownDevice(deviceFilter.root.deviceType)
            ? null
            : {
                kind: "invalidDeviceValue",
                value: deviceFilter.root.deviceType,
                path: `${rootPath}.deviceType`,
              },
        ];
        return deviceIssues.filter((issue): issue is TV3TargetingFilterReference => issue !== null);
      }
      case "surveyInteraction": {
        // Only "specific" scope references surveys; "any" scope matches all surveys and needs no
        // reference check. Each referenced survey id must resolve within the workspace.
        const { value } = resource as TSegmentSurveyInteractionFilter;
        if (value.surveyScope !== "specific") {
          return [];
        }
        return value.surveyIds.map((surveyId, surveyIndex) => ({
          kind: "survey" as const,
          value: surveyId,
          path: `${resourcePath}.value.surveyIds.${surveyIndex}`,
        }));
      }
      default:
        return [];
    }
  });
}

/**
 * Validate that every app-survey targeting filter can resolve — contact-attribute keys (incl. the
 * "userId" person identifier) and referenced segments must exist in the workspace, unsupported person
 * identifiers are rejected, and device values must be a known device. Mirrors trigger action-class
 * validation (see resolveV3SurveyTriggers): each problem becomes a structured `invalid_reference` param
 * the v3 layer maps to a 422. Workspace lookups are skipped when no filter needs them.
 */
export async function assertV3SurveyTargetingFilterReferences(
  workspaceId: string,
  filters: TV3SurveyFilters
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
    const attributeKeys = await getContactAttributeKeys(workspaceId);
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
    // Scope to the workspace's own segments — `getSegment(id)` is global, so a bare existence check
    // would accept (and store) a reference to another workspace's segment.
    const segments = await getSegments(workspaceId);
    const knownSegmentIds = new Set(segments.map((segment) => segment.id));
    for (const reference of segmentRefs.filter((ref) => !knownSegmentIds.has(ref.value))) {
      invalidParams.push({
        name: reference.path,
        reason: `Segment '${reference.value}' was not found in this workspace`,
        code: "invalid_reference",
        identifier: reference.value,
      });
    }
  }

  const surveyRefs = references.filter((ref) => ref.kind === "survey");
  if (surveyRefs.length > 0) {
    // Scope to the workspace's own surveys so a survey-interaction filter cannot reference another
    // workspace's survey.
    const surveys = await getSurveyRefsForWorkspace(workspaceId);
    const knownSurveyIds = new Set(surveys.map((survey) => survey.id));
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
