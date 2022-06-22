import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";

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
          select: { name: true },
        },
        submissionSessions: {
          select: { id: true },
        }
      },
    });
    res.json(formData);
  }

  // POST /api/forms
  // Creates a new form
  // Required fields in body: -
  // Optional fields in body: title, elements, elementsDraft
  else if (req.method === "POST") {
    const { name, schema } = req.body;

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
        id,
        name: name || "",
        schema: schema || {},
        owner: { connect: { email: session?.user?.email } },
      },
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

const generateId = (length) => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

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
