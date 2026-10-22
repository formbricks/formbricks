import "server-only";
import type { CreativeDestinationZodType, CreativeResourceZodType } from "@formbricks/api-v3-schemas";
import {
  getCreativeWarnings,
  needsDestination,
  toCreativeShowConditions,
} from "@/modules/ee/creatives/lib/creative";
import { getCreativeDeliveryGap, getCreativeDisplayState } from "@/modules/ee/creatives/lib/display-status";
import { getDestinationSurveyIssue, toCreativeState } from "@/modules/ee/creatives/lib/record";
import type { TCreativeRecord } from "@/modules/ee/creatives/lib/repository";

/**
 * A stored creative as the v3 `CreativeResource`. The read-only fields are derived here and only here:
 * `displayStatus` and its reason (from the author's status, archiving, the schedule and the Destination
 * survey at `now`), `destination.opensAs` (from the survey's type) and `warnings`.
 */

export type TV3CreativeResource = CreativeResourceZodType;

const serializeDestination = (record: TCreativeRecord): CreativeDestinationZodType | null => {
  if (record.survey) {
    return {
      type: "survey",
      surveyId: record.survey.id,
      surveyName: record.survey.name,
      opensAs: record.survey.type === "app" ? "popup" : "newTab",
    };
  }
  if (record.linkUrl) return { type: "link", url: record.linkUrl, opensAs: "newTab" };
  return null;
};

export const serializeV3Creative = (record: TCreativeRecord, now: Date): TV3CreativeResource => {
  const state = toCreativeState(record);
  const display = getCreativeDisplayState(
    {
      status: state.status,
      archivedAt: state.archivedAt,
      startAt: state.schedule.startAt,
      endAt: state.schedule.endAt,
      destinationSurvey: record.survey
        ? { status: record.survey.status, archivedAt: record.survey.archivedAt }
        : null,
      deliveryGap: getCreativeDeliveryGap({
        needsDestination: needsDestination(state),
        hasDestination: state.destination !== null,
        showOn: state.distribution.showOn,
        triggerCount: state.distribution.triggers.length,
      }),
    },
    now
  );

  const base = {
    id: record.id,
    workspaceId: record.workspaceId,
    name: state.name,
    status: state.status,
    displayStatus: display.status,
    displayStatusReason: display.reason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    publishedAt: state.publishedAt?.toISOString() ?? null,
    archivedAt: state.archivedAt?.toISOString() ?? null,
    creator: record.creator ? { name: record.creator.name } : null,
    defaultLanguage: state.defaultLanguage,
    languages: [
      { code: state.defaultLanguage, default: true, enabled: true },
      ...state.languages.map(({ code, enabled }) => ({ code, default: false, enabled })),
    ],
    destination: serializeDestination(record),
    distribution: {
      ...state.distribution,
      conditions: toCreativeShowConditions(state.distribution.conditions),
    },
    schedule: {
      startAt: state.schedule.startAt?.toISOString() ?? null,
      endAt: state.schedule.endAt?.toISOString() ?? null,
    },
    warnings: getCreativeWarnings(state, record.survey ? getDestinationSurveyIssue(record.survey) : null),
  };

  return state.type === "feedbackButton"
    ? { ...base, type: "feedbackButton", content: state.content, styling: state.styling }
    : { ...base, type: "banner", content: state.content, styling: state.styling };
};
