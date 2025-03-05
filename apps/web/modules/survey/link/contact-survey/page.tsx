import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getSurvey } from "@/modules/survey/lib/survey";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMetadataForContactSurvey } from "./metadata";

interface ContactSurveyPageProps {
  params: {
    jwt: string;
  };
  searchParams: {
    verify?: string;
    lang?: string;
    embed?: string;
    preview?: string;
  };
}

export const generateMetadata = async (props: ContactSurveyPageProps): Promise<Metadata> => {
  const { jwt } = props.params;
  try {
    // Verify and decode the JWT token
    const { surveyId } = verifyContactSurveyToken(jwt);
    return getMetadataForContactSurvey(surveyId);
  } catch (error) {
    // If the token is invalid, we'll return generic metadata
    return {
      title: "Survey",
      description: "Complete this survey",
    };
  }
};

export const ContactSurveyPage = async (props: ContactSurveyPageProps) => {
  const { searchParams, params } = props;
  const { jwt } = params;
  let surveyId, contactId;
  try {
    // Verify and decode the JWT token
    const decoded = verifyContactSurveyToken(jwt);
    surveyId = decoded.surveyId;
    contactId = decoded.contactId;
  } catch (error) {
    return <SurveyInactive status="link invalid" />;
  }

  const isPreview = searchParams.preview === "true";
  const survey = await getSurvey(surveyId);

  if (!survey) {
    notFound();
  }

  return renderSurvey({
    survey,
    searchParams,
    contactId,
    isPreview,
  });
};
