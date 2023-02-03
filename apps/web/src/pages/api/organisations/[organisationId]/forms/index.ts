import { getSessionOrUser } from "@/lib/apiHelper";
import { capturePosthogEvent } from "@/lib/posthog";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const organisationId = req.query.organisationId.toString();

  // check organisation permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organisationId: {
        userId: user.id,
        organisationId,
      },
    },
  });
  if (membership === null) {
    return res
      .status(403)
      .json({ message: "You don't have access to this organisation or this organisation doesn't exist" });
  }

  // GET /api/organisations[organisationId]/forms
  // Get a specific organisation
  if (req.method === "GET") {
    const forms = await prisma.form.findMany({
      where: {
        organisation: {
          id: organisationId,
        },
      },
      include: {
        _count: {
          select: { submissions: true },
        },
      },
    });

    return res.json(forms);
  }

  // POST /api/organisations[organisationId]/forms
  // Create a new form
  // Required fields in body: -
  // Optional fields in body: label, schema
  else if (req.method === "POST") {
    const form = req.body;

    // create form in db
    const result = await prisma.form.create({
      data: {
        ...form,
        organisation: { connect: { id: organisationId } },
      },
    });
    capturePosthogEvent(organisationId, "form created", {
      formId: result.id,
    });
    res.json(result);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
