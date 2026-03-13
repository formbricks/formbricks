import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { getEnvironmentContextForLinkSurvey } from "@/modules/survey/link/lib/environment";
import { getBasicSurveyMetadata, getSurveyOpenGraphMetadata } from "./lib/metadata-utils";

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
  const environmentContext = await getEnvironmentContextForLinkSurvey(survey.environmentId);
  const customFaviconUrl = environmentContext.organizationWhitelabel?.faviconUrl;

  // Use project brand color when survey doesn't override theme styling
  const projectStyling = environmentContext.project.styling;
  const brandColor =
    projectStyling?.allowStyleOverwrite && survey.styling?.overwriteThemeStyling
      ? survey.styling.brandColor?.light
      : projectStyling?.brandColor?.light;

  // Use the shared function for creating the base metadata but override with custom data
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
