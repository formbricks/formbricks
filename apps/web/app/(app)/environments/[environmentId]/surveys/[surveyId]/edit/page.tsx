export const revalidate = REVALIDATION_INTERVAL;
import React from "react";
import { FORMBRICKS_ENCRYPTION_KEY, REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SurveyEditor from "./SurveyEditor";
import { getSurveyWithAnalytics } from "@formbricks/lib/survey/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { ErrorComponent } from "@formbricks/ui";

export default async function SurveysEditPage({ params }) {
  const [survey, product, environment, actionClasses, attributeClasses] = await Promise.all([
    getSurveyWithAnalytics(params.surveyId),
    getProductByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
    getActionClasses(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);
  const isEncryptionKeySet = !!FORMBRICKS_ENCRYPTION_KEY;
  if (!survey || !environment || !actionClasses || !attributeClasses || !product) {
    return <ErrorComponent />;
  }

  return (
    <>
      <SurveyEditor
        survey={survey}
        product={product}
        environment={environment}
        actionClasses={actionClasses}
        attributeClasses={attributeClasses}
        isEncryptionKeySet={isEncryptionKeySet}
      />
    </>
  );
}
