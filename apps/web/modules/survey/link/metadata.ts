import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import {
  getBasicSurveyMetadata,
  getMetadataBrandColor,
  getSurveyOpenGraphMetadata,
} from "./lib/metadata-utils";

export const getMetadataForLinkSurvey = async (
  surveyId: string,
  languageCode?: string
): Promise<Metadata> => {
  const survey = await getSurveyWithMetadata(surveyId);

  if (!survey || survey?.type !== "link" || survey?.status === "draft") {
    notFound();
  }

  const { title, description, ogImage } = await getBasicSurveyMetadata(surveyId, languageCode, survey);

  // Fetch organization whitelabel data for custom favicon
  const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
  const customFaviconUrl = workspaceContext.organizationWhitelabel?.faviconUrl;

  // Use the shared function for creating the base metadata but override with custom data
  const brandColor = getMetadataBrandColor(workspaceContext.workspace.styling, survey.styling);
  const baseMetadata = getSurveyOpenGraphMetadata(survey.id, title, brandColor);

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
