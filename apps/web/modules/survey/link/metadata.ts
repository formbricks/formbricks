import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getSurveyMetadata } from "@/modules/survey/link/lib/survey";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandColorForURL, getNameForURL, getSurveyOpenGraphMetadata } from "./lib/metadata-utils";

export const getMetadataForLinkSurvey = async (surveyId: string): Promise<Metadata> => {
  const survey = await getSurveyMetadata(surveyId);

  if (!survey || survey.type !== "link" || survey.status === "draft") {
    notFound();
  }

  const brandColor = getBrandColorForURL(survey.styling?.brandColor?.light ?? COLOR_DEFAULTS.brandColor);
  const surveyName = getNameForURL(survey.name);
  const ogImgURL = `/api/v1/og?brandColor=${brandColor}&name=${surveyName}`;

  // Use the shared function for creating the base metadata but override with specific OpenGraph data
  const baseMetadata = getSurveyOpenGraphMetadata(survey.id, survey.name);

  // Override with the custom image URL that uses the survey's brand color
  if (baseMetadata.openGraph) {
    baseMetadata.openGraph.images = [ogImgURL];
  }

  if (baseMetadata.twitter) {
    baseMetadata.twitter.images = [ogImgURL];
  }

  const canonicalPath = `/s/${surveyId}`;

  return {
    title: survey.name,
    ...baseMetadata,
    alternates: {
      canonical: canonicalPath,
    },
  };
};
