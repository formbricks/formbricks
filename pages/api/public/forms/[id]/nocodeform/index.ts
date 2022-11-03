import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "../../../../../../lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const formId = req.query.id.toString();
  const session = await getSession({ req });

  // GET /api/forms/:id/nocodeform
  // Get noCodeForm for a form with specific id
  if (req.method === "GET") {
    const form = await prisma.noCodeForm.findUnique({
      where: {
        formId: formId,
      },
      select: {
        id: true,
        form: {
          select: {
            name: true,
            description: true,
            dueDate: true,
            place: true,
            answeringOrder: true,
          },
        },
        published: true,
        closed: true,
        blocks: true,
      },
    });

    const sessionEvents = await prisma.sessionEvent.findMany({
      where: {
        AND: [
          {
            data: {
              path: ["formId"],
              equals: formId,
            },
          },
          {
            data: {
              path: ["candidateId"],
              equals: session.user.id,
            },
          },
        ],
      },
    });

    if (form === null) return res.status(404).json({ error: "not found" });
    return res.json({ form, events: sessionEvents });
  }
}
