import { getSessionOrUser } from "@/lib/apiHelper";
import { prisma } from "@formbricks/database";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const user: any = await getSessionOrUser(req, res);
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const organisationId = req.query.organisationId.toString();

  const customerEmail = req.query.customerEmail.toString();

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

  // GET /api/organisations[organisationId]/customers/[customerEmail]
  // Get a specific organisation
  if (req.method === "GET") {
    const customer = await prisma.customer.findUnique({
      where: {
        email_organisationId: {
          email: customerEmail,
          organisationId,
        },
      },
      include: {
        submissions: { include: { form: true } },
      },
    });

    return res.json(customer);
  }

  // POST /api/organisations[organisationId]/customer/[customerEmail]
  // Replace a specific customer
  else if (req.method === "POST") {
    const data = { ...req.body, updatedAt: new Date() };
    const prismaRes = await prisma.customer.update({
      where: {
        email_organisationId: {
          email: customerEmail,
          organisationId,
        },
      },
      data,
    });
    return res.json(prismaRes);
  }

  // Delete /api/organisations[organisationId]/customer/[customerEmail]
  // Deletes a single customer
  else if (req.method === "DELETE") {
    const prismaRes = await prisma.customer.delete({
      where: {
        email_organisationId: {
          email: customerEmail,
          organisationId: organisationId,
        },
      },
    });
    return res.json(prismaRes);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
