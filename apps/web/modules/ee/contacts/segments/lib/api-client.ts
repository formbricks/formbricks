import type { TSegment, TSegmentCreateInput, TSegmentUpdateInput } from "@formbricks/types/segment";
import type {
  TSegmentFilterSurveyResource,
  TSegmentResource,
  TSurveySegmentResource,
} from "@/app/api/internal/segments/serializers";
import { getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const SEGMENTS_PATH = "/api/internal/segments";

const segmentPath = (segmentId: string) => `${SEGMENTS_PATH}/${encodeURIComponent(segmentId)}`;
const surveySegmentPath = (surveyId: string) =>
  `/api/internal/surveys/${encodeURIComponent(surveyId)}/segment`;

/** A segment as the editors hold it, with its dates back as `Date`s. */
const toSegment = (segment: TSegmentResource): TSegment => ({
  ...segment,
  createdAt: new Date(segment.createdAt),
  updatedAt: new Date(segment.updatedAt),
});

/** Create a segment, for the survey `surveyId` names when it isn't empty. */
export const createSegment = async ({ surveyId, ...input }: TSegmentCreateInput): Promise<TSegment> =>
  toSegment(
    await sendApiRequest<TSegmentResource>(SEGMENTS_PATH, {
      method: "POST",
      body: {
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description,
        isPrivate: input.isPrivate,
        filters: input.filters,
        ...(surveyId ? { surveyId } : {}),
      },
    })
  );

/**
 * Change a segment, or connect surveys to it. Only the fields a segment update takes are sent, so a caller
 * may pass a whole segment.
 */
export const updateSegment = async (segmentId: string, data: TSegmentUpdateInput): Promise<TSegment> =>
  toSegment(
    await sendApiRequest<TSegmentResource>(segmentPath(segmentId), {
      method: "PATCH",
      body: {
        title: data.title,
        description: data.description,
        isPrivate: data.isPrivate,
        filters: data.filters,
        surveys: data.surveys,
      },
    })
  );

/** Delete a segment no survey uses. */
export const deleteSegment = (segmentId: string) =>
  sendApiRequest<void>(segmentPath(segmentId), { method: "DELETE" });

/** Copy a segment and attach the copy to a survey. */
export const copySegment = async (segmentId: string, surveyId: string): Promise<TSegment> =>
  toSegment(
    await sendApiRequest<TSegmentResource>(`${segmentPath(segmentId)}/copies`, {
      method: "POST",
      body: { surveyId },
    })
  );

/** Make a survey target a saved segment; answers the segment it targets now. */
export const attachSurveySegment = async (surveyId: string, segmentId: string): Promise<TSegment> => {
  const { segment } = await sendApiRequest<TSurveySegmentResource>(surveySegmentPath(surveyId), {
    method: "PUT",
    body: { segmentId },
  });
  return toSegment(segment);
};

/** Give a survey its own private segment back, with no filters; answers that segment. */
export const resetSurveySegment = async (surveyId: string): Promise<TSegment> => {
  const { segment } = await sendApiRequest<TSurveySegmentResource>(`${surveySegmentPath(surveyId)}/resets`, {
    method: "POST",
  });
  return toSegment(segment);
};

/** The first distinct values an attribute has. */
export const getContactAttributeKeyValues = (
  contactAttributeKeyId: string,
  { signal }: { signal?: AbortSignal } = {}
) =>
  getApiData<string[]>(
    `/api/internal/contact-attribute-keys/${encodeURIComponent(contactAttributeKeyId)}/values`,
    { signal }
  );

/** The workspace's surveys a survey-interaction filter can name. */
export const listSegmentFilterSurveys = (workspaceId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TSegmentFilterSurveyResource[]>(
    `/api/internal/workspaces/${encodeURIComponent(workspaceId)}/segment-filter-surveys`,
    { signal }
  );
