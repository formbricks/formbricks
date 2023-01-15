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

  const workspaceId = req.query.workspaceId.toString();

  // check workspace permission
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  });
  if (membership === null) {
    return res
      .status(403)
      .json({ message: "You don't have access to this workspace or this workspace doesn't exist" });
  }

  // GET /api/workspaces[workspaceId]/forms
  // Get a specific workspace
  if (req.method === "GET") {
    const forms = await prisma.form.findMany({
      where: {
        workspace: {
          id: workspaceId,
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

  // POST /api/workspaces[workspaceId]/forms
  // Create a new form
  // Required fields in body: -
  // Optional fields in body: label, schema
  else if (req.method === "POST") {
    const form = req.body;

    // create form in db
    const result = await prisma.form.create({
      data: {
        ...form,
        workspace: { connect: { id: workspaceId } },
      },
    });
    capturePosthogEvent(workspaceId, "form created", {
      formId: result.id,
    });
    res.json(result);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
