import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
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
  const surveyBrandColor = survey.styling?.brandColor?.light;

  // Use the shared function for creating the base metadata but override with custom data
  const baseMetadata = getSurveyOpenGraphMetadata(survey.id, title, surveyBrandColor);

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
