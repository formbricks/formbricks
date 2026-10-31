import type {
  TSegmentAttributeFilter,
  TSegmentDeviceFilter,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
  TSegmentSurveyInteractionFilter,
} from "@formbricks/types/segment";
import type { TV3SurveyTargeting } from "./schemas";

/*
 * What a targeting filter tree names, read from the tree alone. Kept apart from `targeting.ts`, which
 * checks the names against the workspace, so code that only reads a survey (a Formbricks file's reader,
 * which runs in the import's worker thread) does not load the database.
 */

type TV3SurveyFilters = TV3SurveyTargeting["filters"];

// Allowed device-filter values; the evaluator compares the contact's runtime device against the
// filter's `value`, so any other value can never match.
export const V3_TARGETING_DEVICE_VALUES = ["phone", "desktop"] as const;

// What a targeting leaf filter must satisfy to be valid, tagged by kind. `attributeKey` covers
// `attribute` filters AND `person` filters (personIdentifier "userId" resolves to the "userId"
// attribute key at evaluation time); `segment` covers segment-membership filters. The remaining kinds
// are static rejections that need no workspace lookup: `unsupportedPersonIdentifier` (a person filter
// whose identifier can never match) and `invalidDeviceValue` (a device filter whose value isn't a
// known device).
export type TV3TargetingFilterReference = {
  kind: "attributeKey" | "segment" | "survey" | "unsupportedPersonIdentifier" | "invalidDeviceValue";
  value: string;
  path: string;
};

/**
 * Walk the (possibly nested) targeting filter tree once and return everything a leaf filter must
 * satisfy to be valid, tagged by kind, each with its JSON path so issues can be reported per-filter.
 */
export function collectV3TargetingFilterReferences(
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
 * The contact attribute keys a targeting filter tree names, each once: attribute filters' keys, and
 * `userId` for a person filter on it. What a Formbricks file embeds so the targeting still resolves in
 * another workspace.
 */
export function collectV3TargetingAttributeKeys(filters: TV3SurveyFilters): string[] {
  const keys = collectV3TargetingFilterReferences(filters, "targeting.filters")
    .filter((reference) => reference.kind === "attributeKey")
    .map((reference) => reference.value);
  return [...new Set(keys)];
}
