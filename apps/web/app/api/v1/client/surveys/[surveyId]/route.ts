import { responses } from "@/lib/api/response";
import type { ApiSuccessResponse } from "@/lib/api/response";
import type { SurveyResponse } from "@formbricks/types/api/client";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";
import { toJson } from "@/lib/utils";

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({} as ApiSuccessResponse);
}

export async function GET(_: Request, { params }: { params: { surveyId: string } }) {
  const { surveyId } = params;

  const survey = await prisma.survey.findFirst({
    where: {
      id: surveyId,
      type: "link",
      status: "inProgress",
    },
    select: {
      id: true,
      questions: true,
      thankYouCard: true,
      environmentId: true,
    },
  });

  // if survey does not exist, return 404
  if (!survey) {
    return responses.notFoundResponse("Survey", surveyId);
  }

  // get brandColor from product using environmentId
  const product = await prisma.product.findFirst({
    where: {
      environments: {
        some: {
          id: survey.environmentId,
        },
      },
    },
    select: {
      brandColor: true,
    },
  });

  // if survey exists, return survey
  return NextResponse.json({
    data: {
      ...survey,
      questions: toJson(survey.questions),
      thankYouCard: toJson(survey.thankYouCard),
      brandColor: product?.brandColor,
    },
  } as ApiSuccessResponse<SurveyResponse>);
}
