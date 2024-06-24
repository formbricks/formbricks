import { MobileSurvey } from "@/app/mobile/[surveyId]/components/MobileSurvey";
import SurveyInactive from "@/app/s/[surveyId]/components/SurveyInactive";
import { notFound } from "next/navigation";
import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { createPerson, getPersonByUserId } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { ZId } from "@formbricks/types/environment";

interface LinkSurveyPageProps {
  params: {
    surveyId: string;
  };
  searchParams: {
    lang?: string;
    userId: string;
  };
}

export default async function LinkSurveyPage({ params, searchParams }: LinkSurveyPageProps) {
  const validId = ZId.safeParse(params.surveyId);
  if (!validId.success) {
    notFound();
  }
  const survey = await getSurvey(params.surveyId);

  const langParam = searchParams.lang; //can either be language code or alias

  if (!survey || survey.type !== "mobile" || survey.status === "draft") {
    notFound();
  }

  const team = await getTeamByEnvironmentId(survey?.environmentId);
  if (!team) {
    throw new Error("Team not found");
  }
  const isMultiLanguageAllowed = await getMultiLanguagePermission(team);

  if (survey && survey.status !== "inProgress") {
    return (
      <SurveyInactive
        status={survey.status}
        surveyClosedMessage={survey.surveyClosedMessage ? survey.surveyClosedMessage : undefined}
      />
    );
  }

  // get product and person
  const product = await getProductByEnvironmentId(survey.environmentId);
  if (!product) {
    throw new Error("Product not found");
  }

  const getLanguageCode = (): string => {
    if (!langParam || !isMultiLanguageAllowed) return "default";
    else {
      const selectedLanguage = survey.languages.find((surveyLanguage) => {
        return surveyLanguage.language.code === langParam || surveyLanguage.language.alias === langParam;
      });
      if (selectedLanguage?.default || !selectedLanguage?.enabled) {
        return "default";
      }
      return selectedLanguage ? selectedLanguage.language.code : "default";
    }
  };

  const languageCode = getLanguageCode();

  const userId = searchParams.userId;
  if (userId) {
    // make sure the person exists or get's created
    const person = await getPersonByUserId(survey.environmentId, userId);
    if (!person) {
      await createPerson(survey.environmentId, userId);
    }
  }

  return (
    <MobileSurvey
      survey={survey}
      product={product}
      userId={userId}
      webAppUrl={WEBAPP_URL}
      languageCode={languageCode}
    />
  );
}
