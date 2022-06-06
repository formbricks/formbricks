import type { NextApiResponse, NextApiRequest } from "next";
import { prisma } from "../../../../../lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const formId = req.query.id.toString();
  // POST /api/surveys/:id/answerSessions
  // Creates a new answer session
  // Required fields in body: -
  // Optional fields in body: -
  if (req.method === "POST") {
    const prismaRes = await prisma.answerSession.create({
      data: { form: { connect: { id: formId } } },
    });
    return res.json(prismaRes);
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
