// filepath: /Users/matthiasnannt/Developer/formbricks/apps/web/modules/survey/link/components/metadata-utils.ts
import { getSurvey } from "@/modules/survey/lib/survey";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { getSurveyMetadata } from "@/modules/survey/link/lib/survey";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@formbricks/lib/constants";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";

/**
 * Utility function to encode name for URL usage
 */
export const getNameForURL = (url: string) => url.replace(/ /g, "%20");

/**
 * Utility function to encode brand color for URL usage
 */
export const getBrandColorForURL = (url: string) => url.replace(/#/g, "%23");

/**
 * Get basic survey metadata (title and description) based on welcome card or survey name
 */
export const getBasicSurveyMetadata = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);

  // If survey doesn't exist, return default metadata
  if (!survey) {
    return {
      title: "Survey",
      description: "Complete this survey",
      survey: null,
    };
  }

  const project = await getProjectByEnvironmentId(survey.environmentId);
  const welcomeCard = survey.welcomeCard as { enabled: boolean; title?: string; subtitle?: string };

  // Set title to either welcome card title or survey name
  let title = "Survey";
  if (welcomeCard.enabled && welcomeCard.title) {
    title = welcomeCard.title;
  } else {
    title = survey.name;
  }

  // Set description to either welcome card subtitle or default
  let description = "";
  if (welcomeCard.enabled && welcomeCard.subtitle) {
    description = welcomeCard.subtitle;
  } else {
    description = "Complete this survey";
  }

  // Add product name in title if it's Formbricks cloud
  if (IS_FORMBRICKS_CLOUD) {
    title = `${title} | Formbricks`;
  } else if (project) {
    title = `${title} | ${project.name}`;
  }

  return {
    title,
    description,
    survey,
  };
};

/**
 * Generate Open Graph metadata for survey
 */
export const getSurveyOpenGraphMetadata = (surveyId: string, surveyName: string): Metadata => {
  const brandColor = getBrandColorForURL(COLOR_DEFAULTS.brandColor); // Default color
  const encodedName = getNameForURL(surveyName);

  const ogImgURL = `/api/v1/og?brandColor=${brandColor}&name=${encodedName}`;

  return {
    metadataBase: new URL(WEBAPP_URL),
    openGraph: {
      title: surveyName,
      description: "Thanks a lot for your time 🙏",
      url: `/s/${surveyId}`,
      siteName: "",
      images: [ogImgURL],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: surveyName,
      description: "Thanks a lot for your time 🙏",
      images: [ogImgURL],
    },
  };
};
