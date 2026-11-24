import type { TSegment, TSegmentCreateInput, TSegmentUpdateInput } from "@formbricks/types/segment";
import type {
  TSegmentFilterSurveysResource,
  TSegmentResource,
  TSurveySegmentResource,
} from "@/app/api/internal/segments/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";

const SEGMENTS_PATH = "/api/internal/segments";

const segmentPath = (segmentId: string) => `${SEGMENTS_PATH}/${encodeURIComponent(segmentId)}`;

/**
 * A segment belongs to its contact directory and every workspace on it may use it (decision 24), so an
 * edit or a delete names the workspace the caller acts from; the segment's own `workspaceId` is only where
 * it was made.
 */
const segmentInWorkspacePath = (segmentId: string, workspaceId: string) =>
  buildApiUrl(segmentPath(segmentId), { workspaceId });
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
export const updateSegment = async (
  segmentId: string,
  workspaceId: string,
  data: TSegmentUpdateInput
): Promise<TSegment> =>
  toSegment(
    await sendApiRequest<TSegmentResource>(segmentInWorkspacePath(segmentId, workspaceId), {
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
export const deleteSegment = (segmentId: string, workspaceId: string) =>
  sendApiRequest<void>(segmentInWorkspacePath(segmentId, workspaceId), { method: "DELETE" });

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

/**
 * The first distinct values an attribute has among the contacts of the workspace's directory. Keys belong to
 * the directory, so the values are read through the workspace the editor is open in.
 */
export const getContactAttributeKeyValues = (
  contactAttributeKeyId: string,
  workspaceId: string,
  { signal }: { signal?: AbortSignal } = {}
) =>
  getApiData<string[]>(
    buildApiUrl(`/api/internal/contact-attribute-keys/${encodeURIComponent(contactAttributeKeyId)}/values`, {
      workspaceId,
    }),
    { signal }
  );

/**
 * The workspace's surveys a survey-interaction filter can name, and which of `surveyIds` (the ids the filter
 * already names) are surveys of another workspace on the directory, so the picker can show those as such.
 */
export const listSegmentFilterSurveys = (
  workspaceId: string,
  surveyIds: readonly string[],
  { signal }: { signal?: AbortSignal } = {}
) =>
  getApiData<TSegmentFilterSurveysResource>(
    buildApiUrl(`/api/internal/workspaces/${encodeURIComponent(workspaceId)}/segment-filter-surveys`, {
      surveyIds: surveyIds.length > 0 ? surveyIds.join(",") : undefined,
    }),
    { signal }
  );
