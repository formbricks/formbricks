import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getSurvey } from "@/modules/survey/lib/survey";
import { Metadata } from "next";

type TBasicSurveyMetadata = {
  title: string;
  description: string;
  survey: Awaited<ReturnType<typeof getSurvey>> | null;
  ogImage?: string;
};

/**
 * Utility function to encode name for URL usage
 */
export const getNameForURL = (url: string) => url.replace(/ /g, "%20");

/**
 * Utility function to encode brand color for URL usage
 */
export const getBrandColorForURL = (url: string) => url.replace(/#/g, "%23");

/**
 * Get basic survey metadata (title and description) based on link metadata, welcome card or survey name
 */
export const getBasicSurveyMetadata = async (
  surveyId: string,
  languageCode = "default"
): Promise<TBasicSurveyMetadata> => {
  const survey = await getSurvey(surveyId);

  // If survey doesn't exist, return default metadata
  if (!survey) {
    return {
      title: "Survey",
      description: "Complete this survey",
      survey: null,
      ogImage: undefined,
    };
  }

  const metadata = survey.metadata;
  const welcomeCard = survey.welcomeCard;
  const useDefaultLanguageCode =
    languageCode === "default" ||
    survey.languages.find((lang) => lang.language.code === languageCode)?.default;

  // Determine language code to use for metadata
  const langCode = useDefaultLanguageCode ? "default" : languageCode;

  // Set title - priority: custom link metadata > welcome card > survey name
  let title = "Survey";
  if (metadata.title?.[langCode]) {
    title = getLocalizedValue(metadata.title, langCode);
  } else if (welcomeCard.enabled && welcomeCard.headline?.[langCode]) {
    title = getLocalizedValue(welcomeCard.headline, langCode);
  } else {
    title = survey.name;
  }

  // Set description - priority: custom link metadata > welcome card > default
  let description = "Complete this survey";
  if (metadata.description?.[langCode]) {
    description = getLocalizedValue(metadata.description, langCode);
  }

  // Get OG image from link metadata if available
  const { ogImage } = metadata;

  if (!metadata.title?.[langCode]) {
    if (IS_FORMBRICKS_CLOUD) {
      title = `${title} | Formbricks`;
    }
  }

  return {
    title,
    description,
    survey,
    ogImage,
  };
};

/**
 * Generate Open Graph metadata for survey
 */
export const getSurveyOpenGraphMetadata = (surveyId: string, surveyName: string): Metadata => {
  const brandColor = getBrandColorForURL(COLOR_DEFAULTS.brandColor); // Default color
  const encodedName = getNameForURL(surveyName);

  const ogImgURL = `/api/v1/client/og?brandColor=${brandColor}&name=${encodedName}`;

  return {
    metadataBase: new URL(getPublicDomain()),
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
