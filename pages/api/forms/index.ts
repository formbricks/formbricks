import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";
import { generateId } from "../../../lib/utils";
import { capturePosthogEvent } from "../../../lib/posthog";
import { FormWhereClause } from "../../../lib/types";
import { UserRole } from "@prisma/client";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check Authentication
  const session = await getSession({ req: req });
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET /api/forms
  // Gets all sourcings for admins and all public for candidates
  if (req.method === "GET") {
    let whereClause: FormWhereClause = {};
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (session.user.role === UserRole.PUBLIC)
      whereClause = {
        dueDate: { gte: today },
        noCodeForm: { published: true },
      };

    const formData = await prisma.form.findMany({
      where: whereClause,
      // include: {
      //   owner: {
      //     select: { firstname: true, lastname: true }
      //   }
      // },
      select: {
        id: true,
        dueDate: true,
        formation: true,
        name: true,
        place: true
      },
      orderBy:{
        dueDate: 'asc'
      }
    });

    if (!formData.length) return res.status(204);
    res.json(formData);
  }

  // POST /api/forms
  // Creates a new form
  // Required fields in body: -
  // Optional fields in body: title, elements, elementsDraft
  else if (req.method === "POST") {
    const form = req.body;
    const session = await getSession({ req });

    if (session.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // get unique alphanumeric ID
    let validId = false;
    let id;
    while (!validId) {
      id = generateId(8);
      validId = await checkIdAvailability(id);
    }
    // create form in database
    const result = await prisma.form.create({
      data: {
        ...form,
        id,
        owner: { connect: { email: session?.user?.email } },
      },
    });
    capturePosthogEvent(session.user.email, "form created", {
      formType: form.formType,
    });
    res.json(result);
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}

export const checkIdAvailability = async (id) => {
  const form = await prisma.form.findUnique({
    where: { id },
  });
  if (form === null) {
    return true;
  } else {
    return false;
  }
};

// POST IMAGE
