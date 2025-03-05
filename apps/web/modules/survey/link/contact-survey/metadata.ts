import { getBasicSurveyMetadata } from "@/modules/survey/link/components/metadata-utils";
import { Metadata } from "next";

export const getMetadataForContactSurvey = async (surveyId: string): Promise<Metadata> => {
  const { title, description } = await getBasicSurveyMetadata(surveyId);

  return {
    title,
    description,
  };
};
