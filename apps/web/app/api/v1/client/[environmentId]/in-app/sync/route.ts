import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TJsStateSync, ZJsPublicSyncInput } from "@formbricks/types/js";
import { NextRequest, NextResponse } from "next/server";
import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function GET(
  _: NextRequest,
  { params }: { params: { environmentId: string } }
): Promise<NextResponse> {
  try {
    // validate using zod
    const environmentIdValidation = ZJsPublicSyncInput.safeParse({
      environmentId: params.environmentId,
    });

    if (!environmentIdValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(environmentIdValidation.error),
        true
      );
    }

    const { environmentId } = environmentIdValidation.data;

    const environment = await getEnvironment(environmentId);

    if (!environment) {
      throw new Error("Environment does not exist");
    }

    if (!environment?.widgetSetupCompleted) {
      await updateEnvironment(environment.id, { widgetSetupCompleted: true });
    }

    const [surveys, noCodeActionClasses, product] = await Promise.all([
      getSurveys(environmentId),
      getActionClasses(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);
    if (!product) {
      throw new Error("Product not found");
    }
    const responseCount = surveys && surveys[0] && (await getResponseCountBySurveyId(surveys[0].id));

    const state: TJsStateSync = {
      surveys: surveys.filter((survey) => survey.status === "inProgress" && survey.type === "web"),
      noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
      product,
      person: null,
      responseCount,
    };

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
}
