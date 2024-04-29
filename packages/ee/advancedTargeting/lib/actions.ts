"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  getSegment,
  resetSegmentInSurvey,
  updateSegment,
} from "@formbricks/lib/segment/service";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { loadNewSegmentInSurvey } from "@formbricks/lib/survey/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TSegmentCreateInput, TSegmentUpdateInput, ZSegmentFilters } from "@formbricks/types/segment";

export const createSegmentAction = async ({
  description,
  environmentId,
  filters,
  isPrivate,
  surveyId,
  title,
}: TSegmentCreateInput) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

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
    description,
    isPrivate,
    filters,
  });

  return segment;
};

export const updateSegmentAction = async (
  environmentId: string,
  segmentId: string,
  data: TSegmentUpdateInput
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

  const { filters } = data;
  if (filters) {
    const parsedFilters = ZSegmentFilters.safeParse(filters);

    if (!parsedFilters.success) {
      const errMsg =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";
      throw new Error(errMsg);
    }
  }

  return await updateSegment(segmentId, data);
};

export const loadNewSegmentAction = async (surveyId: string, segmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

  return await loadNewSegmentInSurvey(surveyId, segmentId);
};

export const cloneSegmentAction = async (segmentId: string, surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

  try {
    const clonedSegment = await cloneSegment(segmentId, surveyId);
    return clonedSegment;
  } catch (err: any) {
    throw new Error(err);
  }
};

export const deleteSegmentAction = async (environmentId: string, segmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

  const foundSegment = await getSegment(segmentId);

  if (!foundSegment) {
    throw new Error(`Segment with id ${segmentId} not found`);
  }

  return await deleteSegment(segmentId);
};

export const resetSegmentFiltersAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

  return await resetSegmentInSurvey(surveyId);
};
