import ContentWrapper from "@/components/shared/ContentWrapper";
import WidgetStatusIndicator from "@/components/shared/WidgetStatusIndicator";
import SurveysList from "./SurveyList";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";

export default async function SurveysPage({ params }) {
  const environmentId = params.environmentId;
  const product = await getProductByEnvironmentId(environmentId);

  return (
    <ContentWrapper className="flex h-full flex-col justify-between">
      <SurveysList environmentId={params.environmentId} product={product} />
      <WidgetStatusIndicator environmentId={params.environmentId} type="mini" />
    </ContentWrapper>
  );
}
