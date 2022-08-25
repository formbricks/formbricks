import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";
import { generateId } from "../../../lib/utils";
import { caputurePosthogEvent } from "../../../lib/posthog";

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
  // Gets all forms of a user
  if (req.method === "GET") {
    const session = await getSession({ req });
    const formData = await prisma.form.findMany({
      where: {
        owner: { email: session.user.email },
      },
      include: {
        owner: {
          select: { firstname: true },
        },
        _count: {
          select: { submissionSessions: true },
        },
      },
    });
    res.json(formData);
  }

  // POST /api/forms
  // Creates a new form
  // Required fields in body: -
  // Optional fields in body: title, elements, elementsDraft
  else if (req.method === "POST") {
    const form = req.body;

    const session = await getSession({ req });
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
    caputurePosthogEvent(session.user.email, "form created");
    res.json(result);
  }

  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}

const checkIdAvailability = async (id) => {
  const form = await prisma.form.findUnique({
    where: { id },
  });
  if (form === null) {
    return true;
  } else {
    return false;
  }
};
