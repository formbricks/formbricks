import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getSurveyMetadata } from "@/modules/survey/link/lib/data";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBasicSurveyMetadata,
  getBrandColorForURL,
  getNameForURL,
  getSurveyOpenGraphMetadata,
} from "./lib/metadata-utils";

export const getMetadataForLinkSurvey = async (
  surveyId: string,
  languageCode?: string
): Promise<Metadata> => {
  const survey = await getSurveyMetadata(surveyId);

  if (!survey || survey.type !== "link" || survey.status === "draft") {
    notFound();
  }

  // Get enhanced metadata that includes custom link metadata
  const { title, description, ogImage } = await getBasicSurveyMetadata(surveyId, languageCode);

  const brandColor = getBrandColorForURL(survey.styling?.brandColor?.light ?? COLOR_DEFAULTS.brandColor);
  const surveyName = getNameForURL(survey.name);

  // Use custom OG image if available, otherwise use generated one
  const ogImgURL = ogImage || `/api/v1/client/og?brandColor=${brandColor}&name=${surveyName}`;

  // Use the shared function for creating the base metadata but override with custom data
  const baseMetadata = getSurveyOpenGraphMetadata(survey.id, title);

  // Override with the custom image URL
  if (baseMetadata.openGraph) {
    baseMetadata.openGraph.images = [ogImgURL];
    baseMetadata.openGraph.description = description;
  }

  if (baseMetadata.twitter) {
    baseMetadata.twitter.images = [ogImgURL];
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
