import { getContactAttributeKeys } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/contact-attribute-key";
import { getSegment } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/segment";
import { getSurvey } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/surveys";
import { TContactWithAttributes } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/types/contact";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { logger } from "@formbricks/logger";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getContactsInSegment = reactCache(
  (surveyId: string, segmentId: string, limit: number, skip: number, attributeKeys?: string) =>
    cache(
      async (): Promise<Result<ApiResponseWithMeta<TContactWithAttributes[]>, ApiErrorResponseV2>> => {
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

          if (survey.environmentId !== segment.environmentId) {
            logger.error({ surveyId, segmentId }, "Survey and segment are not in the same environment");
            const error: ApiErrorResponseV2 = {
              type: "bad_request",
              details: [{ field: "segmentId", issue: "Environment mismatch" }],
            };
            return err(error);
          }

          const segmentFilterToPrismaQueryResult = await segmentFilterToPrismaQuery(
            segment.id,
            segment.filters,
            segment.environmentId
          );

          if (!segmentFilterToPrismaQueryResult.ok) {
            return err(segmentFilterToPrismaQueryResult.error);
          }

          const { whereClause } = segmentFilterToPrismaQueryResult.data;

          const contactAttributeKeysResult = await getContactAttributeKeys(segment.environmentId);
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
      },
      [`getContactsInSegment-${surveyId}-${segmentId}-${attributeKeys}-${limit}-${skip}`],
      {
        tags: [segmentCache.tag.byId(segmentId), surveyCache.tag.byId(surveyId)],
      }
    )()
);
