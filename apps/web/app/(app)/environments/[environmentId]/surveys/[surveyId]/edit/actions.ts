"use server";

import { createUserSegment } from "@formbricks/lib/services/userSegment";
import { TBaseFilterGroup } from "@formbricks/types/v1/userSegment";

export const createUserSegmentAction = async (
  environmentId: string,
  surveyId: string,
  title: string,
  description: string,
  filters: TBaseFilterGroup
) => {
  return await createUserSegment(environmentId, surveyId, title, description, filters);
};
