import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TLinkSurvey, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { isLinkSurveyServable } from "@/modules/survey/link/lib/public-access";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import {
  getBasicSurveyMetadata,
  getMetadataBrandColor,
  getSurveyOpenGraphMetadata,
} from "./lib/metadata-utils";

/**
 * What /c/<token> shows while it can't name the survey: a bad token, or a survey that isn't public. A fresh
 * object per call, since Next receives it by reference.
 */
export const getGenericContactSurveyMetadata = (): Metadata => ({
  title: "Survey",
  description: "Please complete this survey.",
});

/** Title, description, social previews and favicon for a survey the link page serves. */
const getServableSurveyMetadata = async (
  survey: TLinkSurvey,
  languageCode: string | undefined,
  acceptedLanguages: string[]
): Promise<Metadata> => {
  const { title, ogTitle, description, ogImage } = await getBasicSurveyMetadata(
    survey.id,
    languageCode,
    survey,
    acceptedLanguages
  );

  // Fetch organization whitelabel data for custom favicon
  const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
  const customFaviconUrl = workspaceContext.organizationWhitelabel?.faviconUrl;

  // Use the shared function for creating the base metadata but override with custom data
  const brandColor = getMetadataBrandColor(workspaceContext.workspace.styling, survey.styling);
  const baseMetadata = getSurveyOpenGraphMetadata(survey.id, ogTitle, brandColor);

  // Override with the custom image URL
  if (baseMetadata.openGraph) {
    baseMetadata.openGraph.images = ogImage ?? baseMetadata.openGraph.images;
    baseMetadata.openGraph.description = description;
  }

  if (baseMetadata.twitter) {
    baseMetadata.twitter.images = ogImage ?? baseMetadata.twitter.images;
    baseMetadata.twitter.description = description;
  }

  return {
    title,
    description,
    ...baseMetadata,
    ...(customFaviconUrl && { icons: customFaviconUrl }),
  };
};

export const getMetadataForLinkSurvey = async (
  surveyId: string,
  languageCode?: string,
  acceptedLanguages: string[] = []
): Promise<Metadata> => {
  // An unknown id takes the same notFound() path as a non-public one, so both get the same page title
  // (ENG-4032). Their responses can still differ in size and timing, since a missing row loads faster.
  const survey = await getSurveyWithMetadata(surveyId).catch((error: unknown) => {
    if (error instanceof ResourceNotFoundError) {
      notFound();
    }
    throw error;
  });

  // Same gate as the page: an archived survey's name must not reach <title> or og:title on its 404.
  if (!isLinkSurveyServable(survey)) {
    notFound();
  }

  const canonicalPath = `/s/${surveyId}`;

  return {
    ...(await getServableSurveyMetadata(survey, languageCode, acceptedLanguages)),
    alternates: {
      canonical: canonicalPath,
    },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
        noimageindex: true,
      },
    },
  };
};

/**
 * Metadata for /c/<token>, once the token has named a survey. The page 404s a survey that is no longer
 * public (draft, archived, non-link) even with a valid token, so its name or welcome headline must not
 * reach <title> / og:title either (ENG-4032). A survey that can't be loaded gets the same generic metadata.
 */
export const getMetadataForContactSurvey = async (
  surveyId: string,
  acceptedLanguages: string[] = []
): Promise<Metadata> => {
  const survey = await getSurveyWithMetadata(surveyId).catch(() => null);
  if (!survey || !isLinkSurveyServable(survey)) {
    return getGenericContactSurveyMetadata();
  }
  return getServableSurveyMetadata(survey, undefined, acceptedLanguages);
};
