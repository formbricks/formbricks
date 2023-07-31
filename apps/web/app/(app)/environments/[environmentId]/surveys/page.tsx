export const revalidate = REVALIDATION_INTERVAL;

import ContentWrapper from "@/app/shared/ContentWrapper";
import WidgetStatusIndicator from "@/app/shared/WidgetStatusIndicator";
import SurveysList from "./SurveyList";
import { Metadata } from "next";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";

export const metadata: Metadata = {
  title: "Your Surveys",
};

export default async function SurveysPage({ params }) {
  return (
    <ContentWrapper className="flex h-full flex-col justify-between">
      <SurveysList environmentId={params.environmentId} />
      <WidgetStatusIndicator environmentId={params.environmentId} type="mini" />
    </ContentWrapper>
  );
}
