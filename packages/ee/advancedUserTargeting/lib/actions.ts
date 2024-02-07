"use server";

import {
  cloneSegment,
  createSegment,
  deleteSegment,
  getSegment,
  updateSegment,
} from "@formbricks/lib/segment/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { loadNewSegmentInSurvey } from "@formbricks/lib/survey/service";
import { formatDateFields } from "@formbricks/lib/utils/datetime";
import {
  TBaseFilters,
  TSegmentUpdateInput,
  ZSegmentFilters,
  ZSegmentUpdateInput,
} from "@formbricks/types/segment";

export const createSegmentAction = async ({
  description,
  environmentId,
  filters,
  isPrivate,
  surveyId,
  title,
}: {
  environmentId: string;
  surveyId: string;
  title: string;
  description?: string;
  isPrivate: boolean;
  filters: TBaseFilters;
}) => {
  const parsedFilters = ZSegmentFilters.safeParse(filters);

  if (!parsedFilters.success) {
    const errMsg =
      parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
    throw new Error(errMsg);
  }

  const segment = await createSegment({
    environmentId,
    surveyId,
    title,
    description: description || "",
    isPrivate,
    filters,
  });
  surveyCache.revalidate({ id: surveyId });

  return segment;
};

export const updateSegmentAction = async (segmentId: string, data: TSegmentUpdateInput) => {
  const { filters } = data;
  if (filters) {
    const parsedFilters = ZSegmentFilters.safeParse(filters);

    if (!parsedFilters.success) {
      throw new Error("Invalid filters");
    }
  }

  const _data = {
    ...data,
    ...formatDateFields(data, ZSegmentUpdateInput),
  };

  return await updateSegment(segmentId, _data);
};

export const loadNewSegmentAction = async (surveyId: string, segmentId: string) => {
  return await loadNewSegmentInSurvey(surveyId, segmentId);
};

export const cloneSegmentAction = async (segmentId: string, surveyId: string) => {
  try {
    const clonedSegment = await cloneSegment(segmentId, surveyId);
    return clonedSegment;
  } catch (err: any) {
    throw new Error(err);
  }
};

export const deleteSegmentAction = async (segmentId: string) => {
  const foundSegment = await getSegment(segmentId);

  if (!foundSegment) {
    throw new Error(`Segment with id ${segmentId} not found`);
  }

  return await deleteSegment(segmentId);
};
