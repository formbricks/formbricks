import "server-only";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { TDisplay, TDisplayFilters, TDisplayWithContact, ZDisplayFilters } from "@formbricks/types/displays";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";
import { DISPLAY_REJECTED_MESSAGE } from "./errors";

export const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  contactId: true,
} satisfies Prisma.DisplaySelect;

export const getDisplayCountBySurveyId = reactCache(
  async (surveyId: string, filters?: TDisplayFilters): Promise<number> => {
    validateInputs([surveyId, ZId], [filters, ZDisplayFilters.optional()]);

    const { createdAt, responseIds } = filters ?? {};
    if (responseIds?.length === 0) {
      return 0;
    }

    try {
      if (responseIds) {
        const min = createdAt?.min;
        const max = createdAt?.max;
        // Bind the selection as one array so the parameter count stays fixed as it grows.
        const [result] = await prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) AS count
          FROM "Display" d
          JOIN "Response" r ON r."displayId" = d.id
          WHERE d."surveyId" = ${surveyId}
            AND r.id = ANY(${responseIds}::text[])
            ${min ? Prisma.sql`AND d."created_at" >= ${min}` : Prisma.empty}
            ${max ? Prisma.sql`AND d."created_at" <= ${max}` : Prisma.empty}
        `;
        return Number(result.count);
      }

      return await prisma.display.count({
        where: {
          surveyId,
          ...(createdAt && {
            createdAt: {
              gte: createdAt.min,
              lte: createdAt.max,
            },
          }),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

/**
 * Scoped by workspace on purpose: this feeds the contact detail page, which is reached through a
 * workspace id in the URL. A contact id alone is not a tenant boundary, so the displays are
 * filtered through the workspace of the contact they belong to.
 */
export const getDisplaysByContactId = reactCache(
  async (
    contactId: string,
    workspaceId: string,
    /** ENG-3282: the viewer's survey-visibility clause, applied to each display's survey. */
    visibleSurveyWhere: Prisma.SurveyWhereInput
  ): Promise<Pick<TDisplay, "id" | "createdAt" | "surveyId">[]> => {
    validateInputs([contactId, ZId], [workspaceId, ZId]);

    try {
      const displays = await prisma.display.findMany({
        where: {
          contactId,
          contact: { workspaceId },
          ...(Object.keys(visibleSurveyWhere).length > 0 ? { survey: visibleSurveyWhere } : {}),
        },
        select: {
          id: true,
          createdAt: true,
          surveyId: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return displays;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getDisplaysBySurveyIdWithContact = reactCache(
  async (surveyId: string, limit?: number, offset?: number): Promise<TDisplayWithContact[]> => {
    validateInputs(
      [surveyId, ZId],
      [limit, z.int().min(1).optional()],
      [offset, z.int().nonnegative().optional()]
    );

    try {
      const displays = await prisma.display.findMany({
        where: {
          surveyId,
          contactId: { not: null },
        },
        select: {
          id: true,
          createdAt: true,
          surveyId: true,
          contact: {
            select: {
              id: true,
              attributes: {
                where: {
                  attributeKey: {
                    key: { in: ["email", "userId"] },
                  },
                },
                select: {
                  attributeKey: { select: { key: true } },
                  value: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      return displays.map((display) => ({
        id: display.id,
        createdAt: display.createdAt,
        surveyId: display.surveyId,
        contact: display.contact
          ? {
              id: display.contact.id,
              attributes: display.contact.attributes.reduce(
                (acc, attr) => {
                  acc[attr.attributeKey.key] = attr.value;
                  return acc;
                },
                {} as Record<string, string>
              ),
            }
          : null,
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getDisplayForResponseValidation = async (
  displayId: string,
  tx?: Prisma.TransactionClient
): Promise<{
  surveyId: string;
  workspaceId: string;
  responseId: string | null;
  contactId: string | null;
} | null> => {
  validateInputs([displayId, ZId]);
  const client = tx ?? prisma;
  try {
    const display = await client.display.findUnique({
      where: { id: displayId },
      select: {
        surveyId: true,
        contactId: true,
        response: { select: { id: true } },
        survey: { select: { workspaceId: true } },
      },
    });
    if (!display) return null;
    return {
      surveyId: display.surveyId,
      workspaceId: display.survey.workspaceId,
      responseId: display.response?.id ?? null,
      contactId: display.contactId,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw new DatabaseError(error.message);
    throw error;
  }
};

export const assertDisplayOwnership = async (
  displayId: string,
  workspaceId: string,
  surveyId: string,
  contactId: string | null,
  tx?: Prisma.TransactionClient
): Promise<void> => {
  const reason = await findDisplayRejectionReason(displayId, workspaceId, surveyId, contactId, tx);
  if (reason) {
    // The public client-response routes echo this error, so the reason stays in the log (ENG-2240).
    // The id is client-supplied and unbounded; a cuid is 25 characters.
    logger.warn(
      { displayId: displayId.slice(0, 64), workspaceId, surveyId, reason },
      "Rejected displayId on response create"
    );
    throw new InvalidInputError(DISPLAY_REJECTED_MESSAGE);
  }
};

const findDisplayRejectionReason = async (
  displayId: string,
  workspaceId: string,
  surveyId: string,
  contactId: string | null,
  tx?: Prisma.TransactionClient
): Promise<TDisplayRejectionReason | null> => {
  let display: Awaited<ReturnType<typeof getDisplayForResponseValidation>>;
  try {
    display = await getDisplayForResponseValidation(displayId, tx);
  } catch (error) {
    // A malformed id fails the cuid2 check before the lookup, as in validateDisplayScope.
    if (error instanceof ValidationError) return "malformed_id";
    throw error;
  }
  return getDisplayRejectionReason(display, workspaceId, surveyId, contactId);
};

type TDisplayRejectionReason =
  | "malformed_id"
  | "not_found"
  | "different_workspace"
  | "different_survey"
  | "already_linked"
  | "different_contact";

const getDisplayRejectionReason = (
  display: Awaited<ReturnType<typeof getDisplayForResponseValidation>>,
  workspaceId: string,
  surveyId: string,
  contactId: string | null
): TDisplayRejectionReason | null => {
  if (!display) return "not_found";
  if (display.workspaceId !== workspaceId) return "different_workspace";
  if (display.surveyId !== surveyId) return "different_survey";
  if (display.responseId) return "already_linked";
  if (display.contactId !== null && display.contactId !== contactId) return "different_contact";
  return null;
};

/**
 * Whether a caller-supplied `displayId` names a display of `surveyId`. A display belongs to exactly one
 * survey, so matching it against the survey the response is written to is the tightest check there is
 * without requiring more than the management APIs know.
 *
 * Display <-> Response is one-to-one, so connecting a display of another workspace either fails or moves
 * that display onto this response and corrupts the other tenant's display and completion counts.
 * "Does not exist" and "belongs elsewhere" are deliberately the same `false`: telling them apart would
 * make the endpoint a cross-tenant existence oracle for display ids. Callers map `false` to one uniform
 * not-found. The client APIs use `assertDisplayOwnership` instead, whose distinct messages are fine for
 * an unauthenticated respondent that already holds the display id.
 */
export const isDisplayOfSurvey = async (
  displayId: string,
  surveyId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> => {
  const display = await (tx ?? prisma).display.findUnique({
    where: { id: displayId },
    select: { surveyId: true },
  });
  return display?.surveyId === surveyId;
};

export const deleteDisplay = async (displayId: string, tx?: Prisma.TransactionClient): Promise<TDisplay> => {
  validateInputs([displayId, ZId]);
  try {
    const prismaClient = tx ?? prisma;
    const display = await prismaClient.display.delete({
      where: {
        id: displayId,
      },
      select: selectDisplay,
    });

    return display;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
