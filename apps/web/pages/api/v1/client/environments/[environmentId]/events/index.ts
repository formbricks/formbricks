import { prisma } from "@formbricks/database";
import type { NextApiRequest } from "next";
import { CustomNextApiResponse, responses } from "../../../../../../../lib/api/response";

export default async function handle(req: NextApiRequest, res: CustomNextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return responses.missingFieldResponse(res, "environmentId");
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }
  // POST
  else if (req.method === "POST") {
    const { sessionId, eventName, properties } = req.body;

    if (!sessionId) {
      return responses.missingFieldResponse(res, "sessionId");
    }

    if (!eventName) {
      return responses.missingFieldResponse(res, "eventName");
    }

    const eventData = await prisma.event.create({
      data: {
        properties,
        session: {
          connect: {
            id: sessionId,
          },
        },
        eventClass: {
          connectOrCreate: {
            where: {
              name_environmentId: {
                name: eventName,
                environmentId,
              },
            },
            create: {
              name: eventName,
              type: "code",
              environment: {
                connect: {
                  id: environmentId,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return res.json({
      data: eventData,
    });
  }

  // Unknown HTTP Method
  else {
    return responses.methodNotAllowedResponse(res, ["POST", "OPTIONS"]);
  }
}
