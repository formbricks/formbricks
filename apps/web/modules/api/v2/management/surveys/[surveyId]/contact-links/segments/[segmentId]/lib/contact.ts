import { getSegment } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/segment";
import { getSurvey } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/surveys";
import { TGetSegmentContactsResponseData } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/types/contact";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getContactsInSegment = async (
  surveyId: string,
  segmentId: string,
  limit: number,
  skip: number
): Promise<Result<TGetSegmentContactsResponseData, ApiErrorResponseV2>> => {
  try {
    console.log("getContactsInSegment", surveyId, segmentId, limit, skip);
    const surveyResult = await getSurvey(surveyId);
    console.log("surveyResult", surveyResult);
    if (!surveyResult.ok) {
      return err(surveyResult.error);
    }

    const survey = surveyResult.data;

    if (survey.type !== "link") {
      return err({
        type: "forbidden",
        message: "Survey is not a link survey",
        details: [{ field: "surveyId", issue: "Invalid survey" }],
      });
    }

    if (survey.status !== "inProgress") {
      return err({
        type: "forbidden",
        message: "Survey is not active",
        details: [{ field: "surveyId", issue: "Invalid survey" }],
      });
    }

    const segmentResult = await getSegment(segmentId);
    if (!segmentResult.ok) {
      return err(segmentResult.error);
    }

    const segment = segmentResult.data;

    if (survey.environmentId !== segment.environmentId) {
      logger.error({ surveyId, segmentId }, "Survey and segment are not in the same environment");
      return err({
        type: "bad_request",
        message: "Survey and segment are not in the same environment",
        details: [{ field: "segmentId", issue: "Environment mismatch" }],
      });
    }

    const segmentFilterToPrismaQueryResult = await segmentFilterToPrismaQuery(
      segment.id,
      segment.filters,
      segment.environmentId
    );
    console.log("segmentFilterToPrismaQueryResult", segmentFilterToPrismaQueryResult);

    if (!segmentFilterToPrismaQueryResult.ok) {
      return err(segmentFilterToPrismaQueryResult.error);
    }

    const { whereClause } = segmentFilterToPrismaQueryResult.data;

    console.log("lundd");
    const [totalContacts, contacts] = await prisma.$transaction([
      prisma.contact.count({
        where: whereClause,
      }),

      prisma.contact.findMany({
        where: whereClause,
        select: {
          id: true,
          attributes: {
            select: {
              attributeKey: {
                select: {
                  key: true,
                },
              },
              value: true,
            },
          },
        },
        take: limit,
        skip: skip,
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    const contactsWithAttributes = contacts.map((contact) => {
      return {
        id: contact.id,
        ...contact.attributes.reduce(
          (acc, attr) => {
            acc[attr.attributeKey.key] = attr.value;
            return acc;
          },
          {} as Record<string, string>
        ),
      };
    });
    console.log("lundd2");

    return ok({
      data: contactsWithAttributes,
      meta: {
        total: totalContacts,
      },
    });
  } catch (error) {
    console.log("error", error);
    logger.error({ error, surveyId, segmentId }, "Error getting contacts in segment");
    return err({
      type: "internal_server_error",
      message: "Failed to get contacts in segment",
    });
  }
};
