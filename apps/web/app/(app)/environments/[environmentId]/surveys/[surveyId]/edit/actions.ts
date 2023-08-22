"use server";

import { createUserSegment, updateUserSegment } from "@formbricks/lib/services/userSegment";
import {
  TBaseFilterGroup,
  TUserSegmentUpdateInput,
  ZUserSegmentFilterGroup,
} from "@formbricks/types/v1/userSegment";

export const createUserSegmentAction = async (
  environmentId: string,
  surveyId: string,
  title: string,
  description: string,
  filters: TBaseFilterGroup
) => {
  return await createUserSegment(environmentId, surveyId, title, description, filters);
};

export const updateUserSegmentAction = async (segmentId: string, data: TUserSegmentUpdateInput) => {
  const { filters } = data;
  const parsedFilters = ZUserSegmentFilterGroup.safeParse(filters);

  if (!parsedFilters.success) {
    throw new Error("Invalid filters");
  }

  return await updateUserSegment(segmentId, data);
};
