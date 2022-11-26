import { hashApiKey } from "@/lib/apiHelper";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@formbricks/database";
import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { unstable_getServerSession } from "next-auth";
import { getSession } from "next-auth/react";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // Check Authentication
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET /api/users/[userId]/api-keys/
  // Gets all ApiKeys of a user
  if (req.method === "GET") {
    const session = await getSession({ req });
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        user: { email: session.user.email },
      },
    });
    return res.json(apiKeys);
  }
  // POST /api/users/[userId]/api-keys/
  // Creates a ApiKey
  // Required fields in body: -
  // Optional fields in body: note
  else if (req.method === "POST") {
    const apiKey = req.body;

    const key = randomBytes(16).toString("hex");

    const session = await getSession({ req });
    // create form in database
    const result = await prisma.apiKey.create({
      data: {
        ...apiKey,
        hashedKey: hashApiKey(key),
        user: { connect: { email: session?.user?.email } },
      },
    });
    res.json({ ...result, apiKey: key });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
