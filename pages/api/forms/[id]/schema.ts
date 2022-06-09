import type { NextApiResponse, NextApiRequest } from "next";
import NextCors from "nextjs-cors";
import { prisma } from "../../../../lib/prisma";

///api/submissionSession
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await NextCors(req, res, {
    // Options
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });

  const formId = req.query.id.toString();

  // POST /api/forms/:id/schema
  // Updates a form schema
  // Required fields in body: schema
  // Optional fields in body: -
  if (req.method === "POST") {
    const { schema } = req.body;
    const data = { schema, updatedAt: new Date() };
    await prisma.form.update({
      where: { id: formId },
      data,
    });
    return res.json({ success: true });
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
