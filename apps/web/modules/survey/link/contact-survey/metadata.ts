import { getSurvey } from "@/modules/survey/lib/survey";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { Metadata } from "next";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

export const getMetadataForContactSurvey = async (surveyId: string): Promise<Metadata> => {
  const survey = await getSurvey(surveyId);

  // If survey doesn't exist, return default metadata
  if (!survey) {
    return {
      title: "Survey",
      description: "Complete this survey",
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
  };
};
