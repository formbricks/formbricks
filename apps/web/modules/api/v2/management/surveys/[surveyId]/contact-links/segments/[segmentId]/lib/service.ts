import { getSegment } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/segment";
import { getSurvey } from "@/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/surveys";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";

type ContactWithAttributes = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type GetSegmentContactsResponseData = {
  data: Array<ContactWithAttributes>;
  meta: {
    total: number;
  };
};

// Default pagination values
const DEFAULT_LIMIT = 10;
const DEFAULT_SKIP = 0;
// Maximum limit to prevent excessive load
const MAX_LIMIT = 250;

export const getContactsInSegment = async (
  surveyId: string,
  segmentId: string,
  limit: number = DEFAULT_LIMIT,
  skip: number = DEFAULT_SKIP
): Promise<Result<GetSegmentContactsResponseData, ApiErrorResponseV2>> => {
  try {
    // 1. Check if survey exists
    const surveyResult = await getSurvey(surveyId);
    if (!surveyResult.ok) {
      return err(surveyResult.error);
    }

    const survey = surveyResult.data;

    // 2. Check if segment exists
    const segmentResult = await getSegment(segmentId);
    if (!segmentResult.ok) {
      return err(segmentResult.error);
    }

    const segment = segmentResult.data;

    // 3. Check if survey and segment have the same environment
    if (survey.environmentId !== segment.environmentId) {
      return err({
        type: "bad_request",
        message: "Survey and segment are not in the same environment",
        details: [{ field: "segmentId", issue: "Environment mismatch" }],
      });
    }

    // 4. Apply pagination limits
    const constrainedLimit = Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT);
    const constrainedSkip = skip || DEFAULT_SKIP;

    console.log("segment", JSON.stringify(segment, null, 2));
    // 5. Convert segment filters to a Prisma query
    const { whereClause } = segmentFilterToPrismaQuery(segment.filters, segment.environmentId);

    console.log("whereClause", JSON.stringify(whereClause, null, 2));
    // 6. Get total count of contacts in the segment for pagination metadata
    const totalContacts = await prisma.contact.count({
      where: whereClause,
    });

    // 7. Get contacts with pagination
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
      take: constrainedLimit,
      skip: constrainedSkip,
      orderBy: {
        createdAt: "desc",
      },
    });

    // 8. Transform contact data to the desired format
    const contactsWithAttributes = contacts.map((contact) => {
      // Find email, firstName, lastName attributes
      const firstName =
        contact.attributes.find((attr) => attr.attributeKey.key === "firstName")?.value || null;

      const lastName = contact.attributes.find((attr) => attr.attributeKey.key === "lastName")?.value || null;

      const email = contact.attributes.find((attr) => attr.attributeKey.key === "email")?.value || null;

      return {
        id: contact.id,
        firstName,
        lastName,
        email,
      };
    });

    return ok({
      data: contactsWithAttributes,
      meta: {
        total: totalContacts,
      },
    });
  } catch (error) {
    console.error("Error getting contacts in segment:", error);
    return err({
      type: "internal_server_error",
      message: "Failed to get contacts in segment",
    });
  }
};

// api/v2/management/surveys/cm8fqkwxw0000w2ttv1v7835l/contact-links/segments/cm8fqm70v0002w2ttn8reuc53
// [{"id": "miti5bbl32idr3wg3ud4cjpf", "resource": {"id": "deljnfmx8quf0cjpm3swduvk", "root": {"type": "attribute", "contactAttributeKey": "email"}, "value": "example", "qualifier": {"operator": "contains"}}, "connector": null}]
