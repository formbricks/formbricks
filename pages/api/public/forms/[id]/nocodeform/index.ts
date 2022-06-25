import type { NextApiResponse, NextApiRequest } from "next";
import { getSession } from "next-auth/react";
import { formHasOwnership } from "../../../../../../lib/api";
import { prisma } from "../../../../../../lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const formId = req.query.id.toString();

  // GET /api/forms/:id/nocodeform
  // Get noCodeForm for a form with specific id
  if (req.method === "GET") {
    const data = await prisma.noCodeForm.findUnique({
      where: {
        formId: formId,
      },
      select: {
        id: true,
        published: true,
        pages: true,
      },
    });
    if (data === null) return res.status(404).json({ error: "not found" });
    return res.json(data);
  }
}
