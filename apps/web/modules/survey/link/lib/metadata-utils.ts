import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getSurveyDomain } from "@/lib/getSurveyUrl";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getSurvey } from "@/modules/survey/lib/survey";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { Metadata } from "next";
import { TSurveyWelcomeCard } from "@formbricks/types/surveys/types";

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
  const welcomeCard = survey.welcomeCard as TSurveyWelcomeCard;

  // Set title to either welcome card headline or survey name
  let title = "Survey";
  if (welcomeCard.enabled && welcomeCard.headline?.default) {
    title = welcomeCard.headline.default;
  } else {
    title = survey.name;
  }

  // Set description to either welcome card html content or default
  let description = "Complete this survey";
  if (welcomeCard.enabled && welcomeCard.html?.default) {
    description = welcomeCard.html.default;
  }

  // Add product name in title if it's Formbricks cloud
  if (IS_FORMBRICKS_CLOUD) {
    title = `${title} | Formbricks`;
  } else if (project) {
    // Since project name is not available in the returned type, we'll just use a generic name
    title = `${title} | Survey`;
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
    metadataBase: new URL(getSurveyDomain()),
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
