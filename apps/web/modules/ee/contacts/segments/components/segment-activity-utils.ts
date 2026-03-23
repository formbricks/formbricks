import { TBaseFilters, TSegmentWithSurveyRefs } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";

type TSurveySummary = Pick<TSurvey, "id" | "name" | "status">;
type TReferencingSegmentSurveyGroup = {
  segmentId: string;
  segmentTitle: string;
  surveys: TSurveySummary[];
};

export type TSegmentActivitySummary = {
  activeSurveys: string[];
  inactiveSurveys: string[];
};

export const doesSegmentReferenceSegment = (filters: TBaseFilters, targetSegmentId: string): boolean => {
  for (const filter of filters) {
    const { resource } = filter;

    if (Array.isArray(resource)) {
      if (doesSegmentReferenceSegment(resource, targetSegmentId)) {
        return true;
      }
      continue;
    }

    if (resource.root.type === "segment" && resource.root.segmentId === targetSegmentId) {
      return true;
    }
  }

  return false;
};

export const getReferencingSegments = (
  segments: TSegmentWithSurveyRefs[],
  targetSegmentId: string
): TSegmentWithSurveyRefs[] =>
  segments.filter(
    (segment) =>
      segment.id !== targetSegmentId && doesSegmentReferenceSegment(segment.filters, targetSegmentId)
  );

export const buildSegmentActivitySummary = (
  directSurveys: TSurveySummary[],
  indirectSurveyGroups: TReferencingSegmentSurveyGroup[]
): TSegmentActivitySummary => {
  const surveyMap = new Map<string, TSurveySummary>();

  for (const survey of directSurveys) {
    surveyMap.set(survey.id, survey);
  }

  for (const segment of indirectSurveyGroups) {
    for (const survey of segment.surveys) {
      if (!surveyMap.has(survey.id)) {
        surveyMap.set(survey.id, survey);
      }
    }
  }

  const surveys = Array.from(surveyMap.values());

  return {
    activeSurveys: surveys.filter((survey) => survey.status === "inProgress").map((survey) => survey.name),
    inactiveSurveys: surveys
      .filter((survey) => survey.status === "draft" || survey.status === "paused")
      .map((survey) => survey.name),
  };
};

export const buildSegmentActivitySummaryFromSegments = (
  currentSegment: TSegmentWithSurveyRefs,
  segments: TSegmentWithSurveyRefs[]
): TSegmentActivitySummary => {
  const activeSurveyMap = new Map(currentSegment.activeSurveys.map((s) => [s.id, s.name]));
  const inactiveSurveyMap = new Map(currentSegment.inactiveSurveys.map((s) => [s.id, s.name]));
  const allDirectIds = new Set([...activeSurveyMap.keys(), ...inactiveSurveyMap.keys()]);

  const referencingSegments = getReferencingSegments(segments, currentSegment.id);
  for (const segment of referencingSegments) {
    for (const survey of segment.activeSurveys) {
      if (!allDirectIds.has(survey.id) && !activeSurveyMap.has(survey.id)) {
        activeSurveyMap.set(survey.id, survey.name);
      }
    }

    for (const survey of segment.inactiveSurveys) {
      if (!allDirectIds.has(survey.id) && !inactiveSurveyMap.has(survey.id)) {
        inactiveSurveyMap.set(survey.id, survey.name);
      }
    }
  }

  return {
    activeSurveys: Array.from(activeSurveyMap.values()),
    inactiveSurveys: Array.from(inactiveSurveyMap.values()),
  };
};
