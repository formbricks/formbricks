"use server";

import { surveyCache } from "@formbricks/lib/survey/cache";
import {
  cloneUserSegment,
  createUserSegment,
  deleteUserSegment,
  getUserSegment,
  loadNewUserSegment,
  updateUserSegment,
} from "@formbricks/lib/userSegment/service";
import { formatDateFields } from "@formbricks/lib/utils/datetime";
import {
  TBaseFilters,
  TUserSegmentUpdateInput,
  ZUserSegmentFilters,
  ZUserSegmentUpdateInput,
} from "@formbricks/types/userSegment";

export const createUserSegmentAction = async ({
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
  const parsedFilters = ZUserSegmentFilters.safeParse(filters);

  if (!parsedFilters.success) {
    const errMsg =
      parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
    throw new Error(errMsg);
  }

  const segment = await createUserSegment({
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

export const updateUserSegmentAction = async (segmentId: string, data: TUserSegmentUpdateInput) => {
  const { filters } = data;
  if (filters) {
    const parsedFilters = ZUserSegmentFilters.safeParse(filters);

    if (!parsedFilters.success) {
      throw new Error("Invalid filters");
    }
  }

  const _data = {
    ...data,
    ...formatDateFields(data, ZUserSegmentUpdateInput),
  };

  return await updateUserSegment(segmentId, _data);
};

export const loadNewUserSegmentAction = async (surveyId: string, segmentId: string) => {
  return await loadNewUserSegment(surveyId, segmentId);
};

export const cloneUserSegmentAction = async (segmentId: string, surveyId: string) => {
  try {
    const clonedUserSegment = await cloneUserSegment(segmentId, surveyId);
    return clonedUserSegment;
  } catch (err: any) {
    throw new Error(err);
  }
};

export const deleteUserSegmentAction = async (segmentId: string) => {
  const foundSegment = await getUserSegment(segmentId);

  if (!foundSegment) {
    throw new Error(`Segment with id ${segmentId} not found`);
  }

  return await deleteUserSegment(segmentId);
};
