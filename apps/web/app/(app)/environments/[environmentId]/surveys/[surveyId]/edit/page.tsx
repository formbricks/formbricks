export const revalidate = REVALIDATION_INTERVAL;
import React from "react";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import SurveyEditor from "./SurveyEditor";
import { getSurveyWithAnalytics } from "@formbricks/lib/services/survey";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getActionClasses } from "@formbricks/lib/services/actionClass";
import { getAttributeClasses } from "@formbricks/lib/services/attributeClass";
import { ErrorComponent } from "@formbricks/ui";
import { getUserSegments } from "@formbricks/lib/services/userSegment";

export default async function SurveysEditPage({ params }) {
  const [survey, product, environment, actionClasses, attributeClasses, userSegments] = await Promise.all([
    getSurveyWithAnalytics(params.surveyId),
    getProductByEnvironmentId(params.environmentId),
    getEnvironment(params.environmentId),
    getActionClasses(params.environmentId),
    getAttributeClasses(params.environmentId),
    getUserSegments(params.environmentId),
  ]);

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
        userSegments={userSegments}
      />
    </>
  );
}
