import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { TDisplay, TDisplayFilters, TDisplayWithContact } from "@formbricks/types/displays";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";

export const selectDisplay = {
  id: true,
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  contactId: true,
} satisfies Prisma.DisplaySelect;

export const getDisplayCountBySurveyId = reactCache(
  async (surveyId: string, filters?: TDisplayFilters): Promise<number> => {
    validateInputs([surveyId, ZId]);

    try {
      const displayCount = await prisma.display.count({
        where: {
          surveyId: surveyId,
          ...(filters?.createdAt && {
            createdAt: {
              gte: filters.createdAt.min,
              lte: filters.createdAt.max,
            },
          }),
        },
      });
      return displayCount;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getDisplaysByContactId = reactCache(
  async (contactId: string): Promise<Pick<TDisplay, "id" | "createdAt" | "surveyId">[]> => {
    validateInputs([contactId, ZId]);

    try {
      const displays = await prisma.display.findMany({
        where: { contactId },
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
      [limit, z.number().int().min(1).optional()],
      [offset, z.number().int().nonnegative().optional()]
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
