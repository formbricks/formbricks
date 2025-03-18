import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getSurvey } from "@/modules/survey/lib/survey";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getBasicSurveyMetadata } from "@/modules/survey/link/lib/metadata-utils";
import { getExistingContactResponse } from "@/modules/survey/link/lib/response";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface ContactSurveyPageProps {
  params: Promise<{
    jwt: string;
  }>;
  searchParams: Promise<{
    verify?: string;
    lang?: string;
    embed?: string;
    preview?: string;
  }>;
}

export const generateMetadata = async (props: ContactSurveyPageProps): Promise<Metadata> => {
  const { jwt } = await props.params;
  try {
    // Verify and decode the JWT token
    const { surveyId } = verifyContactSurveyToken(jwt);
    return getBasicSurveyMetadata(surveyId);
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
  const { jwt } = await params;

  let surveyId, contactId;
  try {
    // Verify and decode the JWT token
    const decoded = verifyContactSurveyToken(jwt);
    surveyId = decoded.surveyId;
    contactId = decoded.contactId;
  } catch (error) {
    return <SurveyInactive status="link invalid" />;
  }

  const existingResponse = await getExistingContactResponse(surveyId, contactId);
  if (existingResponse) {
    return <SurveyInactive status="response submitted" />;
  }

  const isPreview = (await searchParams).preview === "true";
  const survey = await getSurvey(surveyId);

  if (!survey) {
    notFound();
  }

  return renderSurvey({
    survey,
    searchParams: await searchParams,
    contactId,
    isPreview,
  });
};
