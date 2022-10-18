import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@formbricks/database";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
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
        closed: true,
        blocks: true,
      },
    });
    if (data === null) return res.status(404).json({ error: "not found" });
    return res.json(data);
  }
}
