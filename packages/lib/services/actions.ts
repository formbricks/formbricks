import "server-only";

import z from "zod";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { TAction } from "@formbricks/types/v1/actions";
import { ZId } from "@formbricks/types/v1/environment";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { validateInputs } from "../utils/validate";

export const getActionsByEnvironmentId = cache(
  async (environmentId: string, limit?: number): Promise<TAction[]> => {
    validateInputs([environmentId, ZId], [limit, z.number().optional()]);
    try {
      const actionsPrisma = await prisma.event.findMany({
        where: {
          eventClass: {
            environmentId: environmentId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit ? limit : 20,
        include: {
          eventClass: true,
        },
      });
      const actions: TAction[] = [];
      // transforming response to type TAction[]
      actionsPrisma.forEach((action) => {
        actions.push({
          id: action.id,
          createdAt: action.createdAt,
          sessionId: action.sessionId,
          properties: action.properties,
          actionClass: action.eventClass,
        });
      });
      return actions;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError("Database operation failed");
      }

      throw error;
    }
  }
);
