import { Metadata } from "next";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { recallToHeadline } from "@/lib/utils/recall";
import { getSurvey } from "@/modules/survey/lib/survey";

type TBasicSurveyMetadata = {
  /** Bare title for `metadata.title`. The root layout's `title.template` adds the brand suffix. */
  title: string;
  /**
   * Title for social previews (og:title / twitter:title and the OG image). These are not run through
   * `title.template`, so on Cloud this carries the " | Formbricks" suffix itself, unless the author set
   * a custom link-metadata title.
   */
  ogTitle: string;
  description: string;
  survey: Awaited<ReturnType<typeof getSurvey>> | null;
  ogImage?: string;
};

export const getNameForURL = (value: string) => encodeURIComponent(value);

export const getBrandColorForURL = (value: string) => encodeURIComponent(value);

/**
 * Get basic survey metadata (title and description) based on link metadata, welcome card or survey name.
 *
 * @param surveyId - Survey identifier
 * @param languageCode - Language code for localization (default: "default")
 * @param survey - Optional survey data if already available (e.g., from generateMetadata)
 */
export const getBasicSurveyMetadata = async (
  surveyId: string,
  languageCode = "default",
  survey?: Awaited<ReturnType<typeof getSurvey>> | null
): Promise<TBasicSurveyMetadata> => {
  const surveyData = survey ?? (await getSurvey(surveyId));

  // If survey doesn't exist, return default metadata
  if (!surveyData) {
    return {
      title: "Survey",
      ogTitle: "Survey",
      description: "Please complete this survey.",
      survey: null,
      ogImage: undefined,
    };
  }

  const metadata = surveyData.metadata;
  const welcomeCard = surveyData.welcomeCard;

  // Resolve the language code, accepting either the language code or its alias (case-insensitive).
  const selectedLanguage =
    languageCode === "default"
      ? undefined
      : surveyData.languages.find(
          (lang) =>
            lang.language.code.toLowerCase() === languageCode.toLowerCase() ||
            lang.language.alias?.toLowerCase() === languageCode.toLowerCase()
        );

  // Determine language code to use for metadata
  const langCode =
    !selectedLanguage || selectedLanguage.default || !selectedLanguage.enabled
      ? "default"
      : selectedLanguage.language.code;

  // Set title - priority: custom link metadata > welcome card > survey name
  const titleFromMetadata = metadata?.title ? getLocalizedValue(metadata.title, langCode) || "" : undefined;
  const titleFromWelcome =
    welcomeCard?.enabled && welcomeCard.headline
      ? getTextContent(
          getLocalizedValue(recallToHeadline(welcomeCard.headline, surveyData, false, langCode), langCode)
        ) || ""
      : undefined;
  const title = titleFromMetadata || titleFromWelcome || surveyData.name;

  // Set description - priority: custom link metadata > default
  const descriptionFromMetadata = metadata?.description
    ? getLocalizedValue(metadata.description, langCode) || ""
    : undefined;
  let description = descriptionFromMetadata || "Please complete this survey.";

  // Get OG image from link metadata if available
  const ogImage = metadata?.ogImage;

  // Only the social-preview title is branded here: `<title>` already gets " | Formbricks" from the
  // root layout's template, so suffixing `title` too rendered it twice on Cloud.
  const ogTitle = !titleFromMetadata && IS_FORMBRICKS_CLOUD ? `${title} | Formbricks` : title;

  return {
    title,
    ogTitle,
    description,
    survey: surveyData,
    ogImage,
  };
};

/**
 * Determines the brand color for OG metadata based on workspace and survey styling settings.
 * Uses workspace brand color unless the workspace allows style overwrite AND the survey overrides the theme.
 */
export const getMetadataBrandColor = (
  workspaceStyling: TWorkspaceStyling,
  surveyStyling?: TSurveyStyling | null
): string | undefined => {
  if (!workspaceStyling.allowStyleOverwrite) {
    return workspaceStyling.brandColor?.light;
  }

  return surveyStyling?.overwriteThemeStyling
    ? surveyStyling.brandColor?.light
    : workspaceStyling.brandColor?.light;
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
