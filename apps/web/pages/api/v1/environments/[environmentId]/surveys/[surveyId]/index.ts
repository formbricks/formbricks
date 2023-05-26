import type { AttributeFilter } from "@formbricks/types/surveys";
import { hasEnvironmentAccess } from "@/lib/api/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  const surveyId = req.query.surveyId?.toString();

  if (environmentId === undefined) {
    return res.status(400).json({ message: "Missing environmentId" });
  }
  if (surveyId === undefined) {
    return res.status(400).json({ message: "Missing surveyId" });
  }

  const hasAccess = await hasEnvironmentAccess(req, res, environmentId);
  if (!hasAccess) {
    return res.status(403).json({ message: "Not authorized" });
  }

  // GET
  if (req.method === "GET") {
    const surveyData = await prisma.survey.findFirst({
      where: {
        id: surveyId,
        environmentId,
      },
      include: {
        triggers: true,
        attributeFilters: true,
      },
    });

    if (!surveyData) {
      return res.status(404).json({ message: "Survey not found" });
    }

    const numDisplays = await prisma.display.count({
      where: {
        surveyId,
      },
    });

    const numDisplaysResponded = await prisma.display.count({
      where: {
        surveyId,
        status: "responded",
      },
    });

    // responseRate, rounded to 2 decimal places
    const responseRate = Math.round((numDisplaysResponded / numDisplays) * 100) / 100;

    return res.json({
      ...surveyData,
      responseRate,
      numDisplays,
      triggers: surveyData.triggers.map((t) => t.eventClassId),
      attributeFilters: surveyData.attributeFilters.map((f) => ({
        attributeClassId: f.attributeClassId,
        condition: f.condition,
        value: f.value,
      })),
    });
  }

  // PUT
  else if (req.method === "PUT") {
    const currentTriggers = await prisma.surveyTrigger.findMany({
      where: {
        surveyId,
      },
    });
    const currentAttributeFilters = await prisma.surveyAttributeFilter.findMany({
      where: {
        surveyId,
      },
    });
    let data: any = { updatedAt: new Date() };
    const body = { ...req.body };

    // delete unused fields for link surveys
    if (body.type === "link") {
      delete body.triggers;
      delete body.recontactDays;
    }

    if (body.triggers) {
      const newTriggers: string[] = [];
      const removedTriggers: string[] = [];
      // find added triggers
      for (const eventClassId of body.triggers) {
        if (!eventClassId) {
          continue;
        }
        if (currentTriggers.find((t) => t.eventClassId === eventClassId)) {
          continue;
        } else {
          newTriggers.push(eventClassId);
        }
      }
      // find removed triggers
      for (const trigger of currentTriggers) {
        if (body.triggers.find((t) => t === trigger.eventClassId)) {
          continue;
        } else {
          removedTriggers.push(trigger.eventClassId);
        }
      }
      // create new triggers
      if (newTriggers.length > 0) {
        data.triggers = {
          ...(data.triggers || []),
          create: newTriggers.map((eventClassId) => ({
            eventClassId,
          })),
        };
      }
      // delete removed triggers
      if (removedTriggers.length > 0) {
        data.triggers = {
          ...(data.triggers || []),
          deleteMany: {
            eventClassId: {
              in: removedTriggers,
            },
          },
        };
      }
      delete body.triggers;
    }

    const attributeFilters: AttributeFilter[] = body.attributeFilters;

    if (attributeFilters) {
      const newFilters: AttributeFilter[] = [];
      const removedFilterIds: string[] = [];
      // find added attribute filters
      for (const attributeFilter of attributeFilters) {
        if (!attributeFilter.attributeClassId || !attributeFilter.condition || !attributeFilter.value) {
          continue;
        }
        if (
          currentAttributeFilters.find(
            (f) =>
              f.attributeClassId === attributeFilter.attributeClassId &&
              f.condition === attributeFilter.condition &&
              f.value === attributeFilter.value
          )
        ) {
          continue;
        } else {
          newFilters.push({
            attributeClassId: attributeFilter.attributeClassId,
            condition: attributeFilter.condition,
            value: attributeFilter.value,
          });
        }
      }
      // find removed attribute filters
      for (const attributeFilter of currentAttributeFilters) {
        if (
          attributeFilters.find(
            (f) =>
              f.attributeClassId === attributeFilter.attributeClassId &&
              f.condition === attributeFilter.condition &&
              f.value === attributeFilter.value
          )
        ) {
          continue;
        } else {
          removedFilterIds.push(attributeFilter.attributeClassId);
        }
      }
      // create new attribute filters
      if (newFilters.length > 0) {
        data.attributeFilters = {
          ...(data.attributeFilters || []),
          create: newFilters.map((attributeFilter) => ({
            attributeClassId: attributeFilter.attributeClassId,
            condition: attributeFilter.condition,
            value: attributeFilter.value,
          })),
        };
      }
      // delete removed triggers
      if (removedFilterIds.length > 0) {
        // delete all attribute filters that match the removed attribute classes
        await Promise.all(
          removedFilterIds.map(async (attributeClassId) => {
            await prisma.surveyAttributeFilter.deleteMany({
              where: {
                attributeClassId,
              },
            });
          })
        );
      }
      delete body.attributeFilters;
    }

    data = {
      ...data,
      ...body,
    };

    // remove fields that are not in the survey model
    delete data.responseRate;
    delete data.numDisplays;

    const prismaRes = await prisma.survey.update({
      where: { id: surveyId },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.survey.delete({
      where: { id: surveyId },
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
