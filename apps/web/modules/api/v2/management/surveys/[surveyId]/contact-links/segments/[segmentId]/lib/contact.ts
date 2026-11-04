import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { err, ok } from "@formbricks/types/error-handlers";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { findSegmentSurveyFilterViolation } from "@/modules/ee/contacts/segments/lib/helper";
import { getContactAttributeKeys } from "./contact-attribute-key";
import { getSegment } from "./segment";
import { getSurvey } from "./surveys";

export const getContactsInSegment = reactCache(
  async (
    surveyId: string,
    segmentId: string,
    actor: TSurveyActorContext,
    limit: number,
    skip: number,
    attributeKeys?: string
  ) => {
    try {
      const surveyResult = await getSurvey(surveyId);
      if (!surveyResult.ok) {
        return err(surveyResult.error);
      }

      const survey = surveyResult.data;

      if (survey.type !== "link" || survey.status !== "inProgress") {
        logger.error({ surveyId, segmentId }, "Survey is not a link survey or is not in progress");
        const error: ApiErrorResponseV2 = {
          type: "forbidden",
          details: [{ field: "surveyId", issue: "Invalid survey" }],
        };
        return err(error);
      }

      const segmentResult = await getSegment(segmentId);
      if (!segmentResult.ok) {
        return err(segmentResult.error);
      }

      const segment = segmentResult.data;

      if (survey.workspaceId !== segment.workspaceId) {
        logger.error({ surveyId, segmentId }, "Survey and segment are not in the same workspace");
        const error: ApiErrorResponseV2 = {
          type: "bad_request",
          details: [{ field: "segmentId", issue: "Environment mismatch" }],
        };
        return err(error);
      }

      // ENG-6870: the contacts a survey-interaction filter matches are the people who saw, started or
      // completed the surveys it reads, so the caller must be able to read every one of them.
      if (await findSegmentSurveyFilterViolation(segment.filters, segment.workspaceId, actor, segment.id)) {
        logger.warn({ surveyId, segmentId }, "Segment filters read surveys the caller cannot access");
        const error: ApiErrorResponseV2 = {
          type: "forbidden",
          details: [{ field: "segmentId", issue: "Segment filters read surveys this API key cannot access" }],
        };
        return err(error);
      }

      const segmentFilterToPrismaQueryResult = await segmentFilterToPrismaQuery(
        segment.id,
        segment.filters,
        segment.workspaceId
      );

      if (!segmentFilterToPrismaQueryResult.ok) {
        return err(segmentFilterToPrismaQueryResult.error);
      }

      const { whereClause } = segmentFilterToPrismaQueryResult.data;

      const contactAttributeKeysResult = await getContactAttributeKeys(segment.workspaceId);
      if (!contactAttributeKeysResult.ok) {
        return err(contactAttributeKeysResult.error);
      }

      const allAttributeKeys = contactAttributeKeysResult.data;

      const fieldArray = (attributeKeys || "").split(",").map((field) => field.trim());
      const attributesToInclude = fieldArray.filter((field) => allAttributeKeys.includes(field));

      const allowedAttributes = attributesToInclude.slice(0, 20);

      const [totalContacts, contacts] = await prisma.$transaction([
        prisma.contact.count({
          where: whereClause,
        }),

        prisma.contact.findMany({
          where: whereClause,
          select: {
            id: true,
            attributes: {
              where: {
                attributeKey: {
                  key: {
                    in: allowedAttributes,
                  },
                },
              },
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
        const attributes = contact.attributes.reduce(
          (acc, attr) => {
            acc[attr.attributeKey.key] = attr.value;
            return acc;
          },
          {} as Record<string, string>
        );
        return {
          contactId: contact.id,
          ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
        };
      });

      return ok({
        data: contactsWithAttributes,
        meta: {
          total: totalContacts,
          limit: limit,
          offset: skip,
        },
      });
    } catch (error) {
      logger.error({ error, surveyId, segmentId }, "Error getting contacts in segment");
      const apiError: ApiErrorResponseV2 = {
        type: "internal_server_error",
      };
      return err(apiError);
    }
  }
);
