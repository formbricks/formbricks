import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TLinkSurvey, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { isLinkSurveyServable } from "@/modules/survey/link/lib/public-access";
import {
  type TSingleUseSearchParam,
  getLinkSurveySingleUseAccess,
} from "@/modules/survey/link/lib/single-use-link";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import {
  getBasicSurveyMetadata,
  getMetadataBrandColor,
  getSurveyOpenGraphMetadata,
} from "./lib/metadata-utils";

/**
 * What a survey page shows while it can't name the survey: /c/<token> with a bad token or a survey that isn't
 * public, and /s/<id> for a single-use survey opened without a valid link. A fresh object per call, since Next
 * receives it by reference.
 */
export const getGenericSurveyMetadata = (): Metadata => ({
  title: "Survey",
  description: "Please complete this survey.",
});

/** Title, description, social previews and favicon for a survey the link page serves. */
const getServableSurveyMetadata = async (
  survey: TLinkSurvey,
  languageCode: string | undefined,
  acceptedLanguages: string[]
): Promise<Metadata> => {
  const { title, ogTitle, description, ogImage } = await getBasicSurveyMetadata(
    survey.id,
    languageCode,
    survey,
    acceptedLanguages
  );

  // Fetch organization whitelabel data for custom favicon
  const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
  const customFaviconUrl = workspaceContext.organizationWhitelabel?.faviconUrl;

  // Use the shared function for creating the base metadata but override with custom data
  const brandColor = getMetadataBrandColor(workspaceContext.workspace.styling, survey.styling);
  const baseMetadata = getSurveyOpenGraphMetadata(survey.id, ogTitle, brandColor);

  // Override with the custom image URL
  if (baseMetadata.openGraph) {
    baseMetadata.openGraph.images = ogImage ?? baseMetadata.openGraph.images;
    baseMetadata.openGraph.description = description;
  }

  if (baseMetadata.twitter) {
    baseMetadata.twitter.images = ogImage ?? baseMetadata.twitter.images;
    baseMetadata.twitter.description = description;
  }

  return {
    title,
    description,
    ...baseMetadata,
    ...(customFaviconUrl && { icons: customFaviconUrl }),
  };
};

export const getMetadataForLinkSurvey = async ({
  surveyId,
  languageCode,
  acceptedLanguages = [],
  suId,
  suToken,
}: {
  surveyId: string;
  languageCode?: string;
  acceptedLanguages?: string[];
  /** The single-use link, as it appears in the URL. */
  suId?: TSingleUseSearchParam;
  suToken?: TSingleUseSearchParam;
}): Promise<Metadata> => {
  // An unknown id takes the same notFound() path as a non-public one, so both get the same page title
  // (ENG-4032). Their responses can still differ in size and timing, since a missing row loads faster.
  const survey = await getSurveyWithMetadata(surveyId).catch((error: unknown) => {
    if (error instanceof ResourceNotFoundError) {
      notFound();
    }
    throw error;
  });

  // Same gate as the page: an archived survey's name must not reach <title> or og:title on its 404.
  if (!isLinkSurveyServable(survey)) {
    notFound();
  }

  const pageMetadata: Metadata = {
    alternates: {
      canonical: `/s/${surveyId}`,
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

  // Same single-use gate as the page, sharing its one resolution per request. Without a valid link the page
  // shows only "this survey can only be taken by invitation", so the survey's name or welcome headline must
  // not reach <title> / og:title above it either (ENG-4041).
  if (!getLinkSurveySingleUseAccess({ survey, suId, suToken, surface: "link_page" }).allowed) {
    return { ...getGenericSurveyMetadata(), ...pageMetadata };
  }

  return {
    ...(await getServableSurveyMetadata(survey, languageCode, acceptedLanguages)),
    ...pageMetadata,
  };
};

/**
 * Metadata for /c/<token>, once the token has named a survey. The page 404s a survey that is no longer
 * public (draft, archived, non-link) even with a valid token, so its name or welcome headline must not
 * reach <title> / og:title either (ENG-4032). A survey that can't be loaded gets the same generic metadata, and
 * so does a single-use survey opened without its link, which the page shows as "link invalid" (ENG-4041).
 */
export const getMetadataForContactSurvey = async ({
  surveyId,
  acceptedLanguages = [],
  suId,
  suToken,
}: {
  surveyId: string;
  acceptedLanguages?: string[];
  /** The single-use link, as it appears in the URL. */
  suId?: TSingleUseSearchParam;
  suToken?: TSingleUseSearchParam;
}): Promise<Metadata> => {
  const survey = await getSurveyWithMetadata(surveyId).catch(() => null);
  if (
    !survey ||
    !isLinkSurveyServable(survey) ||
    // Shares the contact page's one resolution per request.
    !getLinkSurveySingleUseAccess({ survey, suId, suToken, surface: "contact_link_page" }).allowed
  ) {
    return getGenericSurveyMetadata();
  }
  return getServableSurveyMetadata(survey, undefined, acceptedLanguages);
};
