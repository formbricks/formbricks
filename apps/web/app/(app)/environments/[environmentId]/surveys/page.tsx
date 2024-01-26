import WidgetStatusIndicator from "@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator";
import { Metadata } from "next";

import ContentWrapper from "@formbricks/ui/ContentWrapper";

import SurveysList from "./components/SurveyList";

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
