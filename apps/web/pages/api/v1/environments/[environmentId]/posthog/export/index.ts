import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query?.environmentId?.toString();

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // POST
  if (req.method === "POST") {
    // lastSyncedAt is the last time the environment was synced (iso string)
    const { lastSyncedAt } = req.body;

    let lastSyncedCondition = lastSyncedAt
      ? {
          OR: [
            {
              createdAt: {
                gt: lastSyncedAt,
              },
            },
            {
              updatedAt: {
                gt: lastSyncedAt,
              },
            },
          ],
        }
      : {};

    // Get all displays that have been created or updated since lastSyncedAt
    const displays = await prisma.display.findMany({
      where: {
        survey: {
          environmentId,
        },
        ...lastSyncedCondition,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        person: {
          select: {
            attributes: {
              select: {
                id: true,
                value: true,
                attributeClass: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get all responses that have been created or updated since lastSyncedAt
    const responses = await prisma.response.findMany({
      where: {
        survey: {
          environmentId,
        },
        ...lastSyncedCondition,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        person: {
          select: {
            attributes: {
              select: {
                id: true,
                value: true,
                attributeClass: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const events = [
      ...displays.map((display) => ({
        name: "formbricks_display_created",
        timestamp: display.createdAt,
        userId: display.person?.attributes?.find((attr) => attr.attributeClass.name === "userId")?.value,
      })),
      ...responses.map((response) => ({
        name: "formbricks_response_created",
        timestamp: response.createdAt,
        userId: response.person?.attributes?.find((attr) => attr.attributeClass.name === "userId")?.value,
      })),
    ];

    return res.json({ events, lastSyncedAt: new Date().toISOString() });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
