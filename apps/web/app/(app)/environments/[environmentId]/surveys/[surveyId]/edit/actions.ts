"use server";

import {
  cloneUserSegment,
  createUserSegment,
  loadNewUserSegment,
  updateUserSegment,
  deleteUserSegment,
  getUserSegment,
} from "@formbricks/lib/services/userSegment";
import {
  TBaseFilterGroup,
  TUserSegmentUpdateInput,
  ZUserSegmentFilterGroup,
} from "@formbricks/types/v1/userSegment";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { deleteSurvey, updateSurvey } from "@formbricks/lib/services/survey";

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
  description: string;
  isPrivate: boolean;
  filters: TBaseFilterGroup;
}) => {
  const parsedFilters = ZUserSegmentFilterGroup.safeParse(filters);

  if (!parsedFilters.success) {
    const errMsg =
      parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
    throw new Error(errMsg);
  }

  return await createUserSegment(environmentId, surveyId, title, description, isPrivate, filters);
};

export const updateUserSegmentAction = async (segmentId: string, data: TUserSegmentUpdateInput) => {
  const { filters } = data;
  const parsedFilters = ZUserSegmentFilterGroup.safeParse(filters);

  if (!parsedFilters.success) {
    throw new Error("Invalid filters");
  }

  return await updateUserSegment(segmentId, data);
};

export const loadNewUserSegmentAction = async (surveyId: string, segmentId: string) => {
  return await loadNewUserSegment(surveyId, segmentId);
};

export const cloneUserSegmentAction = async (segmentId: string, surveyId: string) => {
  try {
    const clonedUserSegment = await cloneUserSegment(segmentId, surveyId);
    return clonedUserSegment;
  } catch (err) {
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

export async function surveyMutateAction(survey: TSurvey): Promise<TSurvey> {
  return await updateSurvey(survey);
}

export async function deleteSurveyAction(surveyId: string) {
  await deleteSurvey(surveyId);
}
