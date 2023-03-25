import { getSessionOrUser, hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { capturePosthogEvent } from "@/lib/posthogServer";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const environmentId = req.query.environmentId?.toString();
  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const attributeClassId = req.query.attributeClassId?.toString();
  if (attributeClassId === undefined) {
    return res.status(400).json({ message: "Missing attributeClassId" });
  }

  const hasAccess = await hasEnvironmentAccess(user, environmentId);
  if (hasAccess === false) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    const attributeClass = await prisma.attributeClass.findFirst({
      where: {
        id: attributeClassId,
        environmentId,
      },
    });

    return res.json(attributeClass);
  }

  // PUT
  else if (req.method === "PUT") {
    const currentAttributeClass = await prisma.attributeClass.findUnique({
      where: {
        id: attributeClassId,
      },
    });
    if (currentAttributeClass === null) {
      return res.status(404).json({ message: "Attribute class not found" });
    }
    if (currentAttributeClass.type === "automatic") {
      return res.status(403).json({ message: "Automatic attribute classes cannot be updated" });
    }

    const attributeClass = await prisma.attributeClass.update({
      where: {
        id: attributeClassId,
      },
      data: {
        ...req.body,
      },
    });

    capturePosthogEvent(user.id, "attribute class updated", {
      attributeClassId,
    });

    return res.json(attributeClass);
  }

  // Delete
  else if (req.method === "DELETE") {
    const currentAttributeClass = await prisma.attributeClass.findFirst({
      where: {
        id: attributeClassId,
        environmentId,
      },
    });
    if (currentAttributeClass === null) {
      return res.status(404).json({ message: "Attribute class not found" });
    }
    if (currentAttributeClass.type === "automatic") {
      return res.status(403).json({ message: "Automatic attribute classes cannot be deleted" });
    }

    const prismaRes = await prisma.survey.delete({
      where: { id: attributeClassId },
    });
    capturePosthogEvent(user.id, "attributeClass deleted", {
      attributeClassId,
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
