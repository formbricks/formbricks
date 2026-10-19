import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { isLinkSurveyServable } from "@/modules/survey/link/lib/public-access";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import {
  getBasicSurveyMetadata,
  getMetadataBrandColor,
  getSurveyOpenGraphMetadata,
} from "./lib/metadata-utils";

export const getMetadataForLinkSurvey = async (
  surveyId: string,
  languageCode?: string,
  acceptedLanguages: string[] = []
): Promise<Metadata> => {
  // An unknown id must end up exactly where a non-public one does, or the page title (empty vs the
  // not-found title) tells the two apart (ENG-4032).
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

  const { title, ogTitle, description, ogImage } = await getBasicSurveyMetadata(
    surveyId,
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

  const canonicalPath = `/s/${surveyId}`;

  return {
    title,
    description,
    ...baseMetadata,
    ...(customFaviconUrl && { icons: customFaviconUrl }),
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
