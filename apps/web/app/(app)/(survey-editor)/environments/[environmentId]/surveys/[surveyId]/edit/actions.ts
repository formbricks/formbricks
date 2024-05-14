"use server";

import { getServerSession } from "next-auth";

import { createActionClass } from "@formbricks/lib/actionClass/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { canUserAccessProduct } from "@formbricks/lib/product/auth";
import { getProduct } from "@formbricks/lib/product/service";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  getSegment,
  resetSegmentInSurvey,
  updateSegment,
} from "@formbricks/lib/segment/service";
import { canUserAccessSurvey, verifyUserRoleAccess } from "@formbricks/lib/survey/auth";
import { surveyCache } from "@formbricks/lib/survey/cache";
import {
  deleteSurvey,
  getSurvey,
  loadNewSegmentInSurvey,
  updateSurvey,
} from "@formbricks/lib/survey/service";
import { TActionClassInput } from "@formbricks/types/actionClasses";
import { AuthorizationError } from "@formbricks/types/errors";
import { TProduct } from "@formbricks/types/product";
import { TBaseFilters, TSegmentUpdateInput, ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys";

export const surveyMutateAction = async (survey: TSurvey): Promise<TSurvey> => {
  return await updateSurvey(survey);
};

export const updateSurveyAction = async (survey: TSurvey): Promise<TSurvey> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, survey.id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(survey.environmentId, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await updateSurvey(survey);
};

export const deleteSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const survey = await getSurvey(surveyId);
  const { hasDeleteAccess } = await verifyUserRoleAccess(survey!.environmentId, session.user.id);
  if (!hasDeleteAccess) throw new AuthorizationError("Not authorized");

  await deleteSurvey(surveyId);
};

export const refetchProductAction = async (productId: string): Promise<TProduct | null> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessProduct(session.user.id, productId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const product = await getProduct(productId);
  return product;
};

export const createBasicSegmentAction = async ({
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
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = hasUserEnvironmentAccess(session.user.id, environmentId);
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
    description: description || "",
    isPrivate,
    filters,
  });
  surveyCache.revalidate({ id: surveyId });

  return segment;
};

export const updateBasicSegmentAction = async (
  environmentId: string,
  segmentId: string,
  data: TSegmentUpdateInput
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = hasUserEnvironmentAccess(session.user.id, environmentId);
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

export const loadNewBasicSegmentAction = async (surveyId: string, segmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

  return await loadNewSegmentInSurvey(surveyId, segmentId);
};

export const cloneBasicSegmentAction = async (segmentId: string, surveyId: string) => {
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

export const deleteBasicSegmentAction = async (environmentId: string, segmentId: string) => {
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

export const resetBasicSegmentFiltersAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const environmentAccess = await canUserAccessSurvey(session.user.id, surveyId);
  if (!environmentAccess) throw new AuthorizationError("Not authorized");

  return await resetSegmentInSurvey(surveyId);
};

export const getImagesFromUnsplashAction = async (searchQuery: string, page: number = 1) => {
  if (!UNSPLASH_ACCESS_KEY) {
    throw new Error("Unsplash access key is not set");
  }
  const baseUrl = "https://api.unsplash.com/search/photos";
  const params = new URLSearchParams({
    query: searchQuery,
    client_id: UNSPLASH_ACCESS_KEY,
    orientation: "landscape",
    per_page: "9",
    page: page.toString(),
  });

  try {
    const response = await fetch(`${baseUrl}?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch images from Unsplash");
    }

    const { results } = await response.json();
    return results.map((result) => {
      const authorName = encodeURIComponent(result.user.first_name + " " + result.user.last_name);
      const authorLink = encodeURIComponent(result.user.links.html);

      return {
        id: result.id,
        alt_description: result.alt_description,
        urls: {
          regularWithAttribution: `${result.urls.regular}&dpr=2&authorLink=${authorLink}&authorName=${authorName}&utm_source=formbricks&utm_medium=referral`,
          download: result.links.download_location,
        },
      };
    });
  } catch (error) {
    throw new Error("Error getting images from Unsplash");
  }
};

export const triggerDownloadUnsplashImageAction = async (downloadUrl: string) => {
  try {
    const response = await fetch(`${downloadUrl}/?client_id=${UNSPLASH_ACCESS_KEY}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to download image from Unsplash");
    }

    return;
  } catch (error) {
    throw new Error("Error downloading image from Unsplash");
  }
};

export const createActionClassAction = async (action: TActionClassInput) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, action.environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createActionClass(action.environmentId, action);
};
