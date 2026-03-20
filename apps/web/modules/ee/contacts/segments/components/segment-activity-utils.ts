import { TBaseFilters, TSegment, TSegmentWithSurveyNames } from "@formbricks/types/segment";
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

export const getReferencingSegments = (segments: TSegment[], targetSegmentId: string): TSegment[] =>
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
  currentSegment: TSegmentWithSurveyNames,
  segments: TSegmentWithSurveyNames[]
): TSegmentActivitySummary => {
  const activeSurveys = new Set(currentSegment.activeSurveys);
  const inactiveSurveys = new Set(currentSegment.inactiveSurveys);
  const directSurveyNames = new Set([...activeSurveys, ...inactiveSurveys]);

  const referencingSegments = getReferencingSegments(
    segments,
    currentSegment.id
  ) as TSegmentWithSurveyNames[];
  for (const segment of referencingSegments) {
    for (const surveyName of segment.activeSurveys) {
      if (!directSurveyNames.has(surveyName)) {
        activeSurveys.add(surveyName);
      }
    }

    for (const surveyName of segment.inactiveSurveys) {
      if (!directSurveyNames.has(surveyName)) {
        inactiveSurveys.add(surveyName);
      }
    }
  }

  return {
    activeSurveys: Array.from(activeSurveys),
    inactiveSurveys: Array.from(inactiveSurveys),
  };
};
