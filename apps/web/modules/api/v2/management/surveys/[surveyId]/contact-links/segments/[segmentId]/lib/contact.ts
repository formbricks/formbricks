import { getSegment } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/segment";
import { getSurvey } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/surveys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";

type ContactWithAttributes = {
  id: string;
} & Record<string, string>;

type GetSegmentContactsResponseData = {
  data: Array<ContactWithAttributes>;
  meta: {
    total: number;
  };
};

export const getContactsInSegment = async (
  surveyId: string,
  segmentId: string,
  limit: number,
  skip: number
): Promise<Result<GetSegmentContactsResponseData, ApiErrorResponseV2>> => {
  try {
    const surveyResult = await getSurvey(surveyId);
    if (!surveyResult.ok) {
      return err(surveyResult.error);
    }

    const survey = surveyResult.data;

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

    let whereClause: Prisma.ContactWhereInput;
    try {
      const { whereClause: resultWhereClause } = await segmentFilterToPrismaQuery(
        segment.id,
        segment.filters,
        segment.environmentId
      );
      whereClause = resultWhereClause;
    } catch (error) {
      logger.error({ error, segmentId, surveyId }, "Error converting segment filters to Prisma query");
      return err({
        type: "bad_request",
        message: "Failed to convert segment filters to Prisma query",
        details: [{ field: "segment", issue: "Invalid segment filters" }],
      });
    }
    logger.info({ whereClause }, "whereClause");
    const totalContacts = await prisma.contact.count({
      where: whereClause,
    });

    const contacts = await prisma.contact.findMany({
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
    });

    const contactsWithAttributes = contacts.map((contact) => {
      return {
        id: contact.id,
        ...contact.attributes.reduce((acc, attr) => {
          acc[attr.attributeKey.key] = attr.value;
          return acc;
        }, {}),
      };
    });

    return ok({
      data: contactsWithAttributes,
      meta: {
        total: totalContacts,
      },
    });
  } catch (error) {
    logger.error({ error, surveyId, segmentId }, "Error getting contacts in segment");
    return err({
      type: "internal_server_error",
      message: "Failed to get contacts in segment",
    });
  }
};
