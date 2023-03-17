import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await NextCors(req, res, {
    // Options
    methods: ["PUT"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });
  const session = await getSession({ req: req });

  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.method === "PUT") {
    const { id } = req.body;
    const updtDate = req.body;
    delete updtDate.id;

    let updateAddress;
    await prisma.address.upsert({
      where: {
        id,
      },
      create: req.body,
      update: req.body,
    });
    return res.json(updateAddress);
  }
}
