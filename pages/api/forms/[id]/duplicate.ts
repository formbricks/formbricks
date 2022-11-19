import { UserRole } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { checkIdAvailability } from "..";
import { capturePosthogEvent } from "../../../../lib/posthog";
import { generateId } from "../../../../lib/utils";
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

  // POST /api/forms/:id/duplicate
  // Duplicates a form
  if (req.method === "POST") {
    const session = await getSession({ req });
    const form = JSON.parse(req.body).form;
    const { name, description, dueDate, place, answeringOrder, noCodeForm } =
      form;

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
        name: `Copie de "${name}"`,
        description,
        dueDate,
        place,
        answeringOrder,
        id,
        owner: { connect: { email: session?.user?.email } },
        noCodeForm: {
          connect: noCodeForm.id,
          create: noCodeForm,
        },
      },
      include: {
        noCodeForm: true, // Include all posts in the returned object
      },
    });
    capturePosthogEvent(session.user.email, "form created", {
      formType: form.formType,
    });
    res.json({ ...result, owner: form.owner });
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
