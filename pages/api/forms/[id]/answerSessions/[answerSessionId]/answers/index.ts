import type { NextApiResponse, NextApiRequest } from "next";
import { prisma } from "../../../../../../../lib/prisma";

///api/answerSession
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const answerSessionId = req.query.answerSessionId.toString();
  // POST /api/surveys/:id/answerSessions/:answerSessionId/answers
  // Creates a new answer
  // Required fields in body: elementId, data
  // Optional fields in body: -
  if (req.method === "POST") {
    /* const { elementId, data } = req.body;
    const prismaRes = await prisma.answer.create({
      data: {
        data,
        elementId,
        answerSession: { connect: { id: answerSessionId } },
      },
    });
    return res.json(prismaRes); */
    return res.json({});
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
