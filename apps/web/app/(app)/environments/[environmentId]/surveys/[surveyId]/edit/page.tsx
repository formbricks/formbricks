export const revalidate = REVALIDATION_INTERVAL;
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import SurveyEditor from "./components/SurveyEditor";

export default async function SurveysEditPage({ params }) {
  const [survey, product, environment, actionClasses, attributeClasses, responseCount] = await Promise.all([
    getSurvey(params.surveyId),
    getProductByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
    getActionClasses(params.environmentId),
    getAttributeClasses(params.environmentId),
    getResponseCountBySurveyId(params.surveyId),
  ]);

  if (!survey || !environment || !actionClasses || !attributeClasses || !product) {
    return <ErrorComponent />;
  }

  const animationsFiles = [
    "http://localhost:3000/storage/clobsi16y0009kezgiea5k71o/public/1_4k.mp4",
    "http://localhost:3000/storage/clobsi16y0009kezgiea5k71o/public/2_4k.mp4",
    "/animated-bgs/4K/3_4k.mp4",
    "/animated-bgs/4K/4_4k.mp4",
    "/animated-bgs/4K/5_4k.mp4",
    "/animated-bgs/4K/6_4k.mp4",
    "/animated-bgs/4K/7_4k.mp4",
    "/animated-bgs/4K/8_4k.mp4",
    "/animated-bgs/4K/9_4k.mp4",
    "/animated-bgs/4K/10_4k.mp4",
    "/animated-bgs/4K/11_4k.mp4",
    "/animated-bgs/4K/12_4k.mp4",
    "/animated-bgs/4K/13_4k.mp4",
    "/animated-bgs/4K/14_4k.mp4",
    "/animated-bgs/4K/15_4k.mp4",
    "/animated-bgs/4K/16_4k.mp4",
    "/animated-bgs/4K/17_4k.mp4",
    "/animated-bgs/4K/18_4k.mp4",
    "/animated-bgs/4K/19_4k.mp4",
    "/animated-bgs/4K/20_4k.mp4",
    "/animated-bgs/4K/21_4k.mp4",
    "/animated-bgs/4K/22_4k.mp4",
    "/animated-bgs/4K/23_4k.mp4",
    "/animated-bgs/4K/24_4k.mp4",
    "/animated-bgs/4K/25_4k.mp4",
    "/animated-bgs/4K/26_4k.mp4",
    "/animated-bgs/4K/27_4k.mp4",
    "/animated-bgs/4K/28_4k.mp4",
    "/animated-bgs/4K/29_4k.mp4",
    "/animated-bgs/4K/30_4k.mp4",
  ];
  return (
    <>
      <SurveyEditor
        animationsFiles={animationsFiles}
        survey={survey}
        product={product}
        environment={environment}
        actionClasses={actionClasses}
        attributeClasses={attributeClasses}
        responseCount={responseCount}
      />
    </>
  );
}
