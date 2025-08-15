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

export const getNameForURL = (value: string) => encodeURIComponent(value);

export const getBrandColorForURL = (value: string) => encodeURIComponent(value);

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
      description: "Please complete this survey.",
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
  const titleFromMetadata = metadata?.title ? getLocalizedValue(metadata.title, langCode) || "" : undefined;
  const titleFromWelcome =
    welcomeCard?.enabled && welcomeCard.headline
      ? getLocalizedValue(welcomeCard.headline, langCode) || ""
      : undefined;
  let title = titleFromMetadata || titleFromWelcome || survey.name;

  // Set description - priority: custom link metadata > default
  const descriptionFromMetadata = metadata?.description
    ? getLocalizedValue(metadata.description, langCode) || ""
    : undefined;
  let description = descriptionFromMetadata || "Please complete this survey.";

  // Get OG image from link metadata if available
  const { ogImage } = metadata;

  if (!titleFromMetadata) {
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
export const getSurveyOpenGraphMetadata = (
  surveyId: string,
  surveyName: string,
  surveyBrandColor?: string
): Metadata => {
  const encodedName = getNameForURL(surveyName);
  const brandColor = getBrandColorForURL(surveyBrandColor ?? COLOR_DEFAULTS.brandColor);
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
