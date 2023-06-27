import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { sendToPipeline } from "@/lib/pipelines";
import { prisma } from "@formbricks/database";
import { InvalidInputError } from "@formbricks/errors";
import { capturePosthogEvent } from "@formbricks/lib/posthogServer";
import { createResponse } from "@formbricks/lib/services/response";
import { getSurvey } from "@formbricks/lib/services/survey";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { TResponseInput, ZResponseInput } from "@formbricks/types/v1/responses";
import { NextResponse } from "next/server";
import { UAParser } from "ua-parser-js";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(request: Request): Promise<NextResponse> {
  const responseInput: TResponseInput = await request.json();
  const agent = UAParser(request.headers.get("user-agent"));
  const inputValidation = ZResponseInput.safeParse(responseInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  let survey;

  try {
    survey = await getSurvey(responseInput.surveyId);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // prisma call to get the teamId
  // TODO use services
  const environment = await prisma.environment.findUnique({
    where: { id: survey.environmentId },
    include: {
      product: {
        select: {
          team: {
            select: {
              id: true,
              memberships: {
                where: { role: "owner" },
                select: { userId: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!environment) {
    return responses.internalServerErrorResponse("Environment not found");
  }
  const {
    product: {
      team: { id: teamId, memberships },
    },
  } = environment;

  const teamOwnerId = memberships[0]?.userId;

  let response;

  try {
    const meta = {
      userAgent: {
        browser: agent?.browser.name,
        device: agent?.device.type,
        os: agent?.os.name,
      },
    };

    response = await createResponse({
      ...responseInput,
      meta,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    } else {
      return responses.internalServerErrorResponse(error.message);
    }
  }

  sendToPipeline({
    event: "responseCreated",
    environmentId: survey.environmentId,
    surveyId: response.surveyId,
    data: response,
  });

  if (responseInput.finished) {
    sendToPipeline({
      event: "responseFinished",
      environmentId: survey.environmentId,
      surveyId: response.surveyId,
      data: response,
    });
  }

  captureTelemetry("response created");
  if (teamOwnerId) {
    await capturePosthogEvent(teamOwnerId, "response created", teamId, {
      surveyId: response.surveyId,
      surveyType: survey.type,
    });
  } else {
    console.warn("Posthog capture not possible. No team owner found");
  }

  return responses.successResponse(response, true);
}
