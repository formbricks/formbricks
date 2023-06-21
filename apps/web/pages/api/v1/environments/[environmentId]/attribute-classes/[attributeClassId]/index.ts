import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();
  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  const attributeClassId = req.query.attributeClassId?.toString();
  if (attributeClassId === undefined) {
    return res.status(400).json({ message: "Missing attributeClassId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
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

    const activeSurveysData = await prisma.surveyAttributeFilter.findMany({
      where: {
        attributeClassId,
        survey: {
          status: "inProgress",
        },
      },
      select: {
        survey: {
          select: {
            name: true,
          },
        },
      },
    });

    const activeSurveys = activeSurveysData.map((t) => t.survey.name);

    const inactiveSurveysData = await prisma.surveyAttributeFilter.findMany({
      where: {
        attributeClassId,
        survey: {
          status: {
            in: ["paused", "completed"],
          },
        },
      },
      select: {
        survey: {
          select: {
            name: true,
          },
        },
      },
    });
    const inactiveSurveys = inactiveSurveysData.map((t) => t.survey.name);

    return res.json({
      ...attributeClass,
      activeSurveys,
      inactiveSurveys,
    });
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
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
