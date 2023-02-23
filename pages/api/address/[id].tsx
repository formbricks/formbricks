import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";

export default async function handle(req: NextApiRequest, res: NextApiResponse)
{
  await NextCors(req, res, {
    // Options
    methods: ["GET", "PUT"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });
  const session = await getSession({ req: req });

  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.method === "GET") {
    const { id } = req.query;
    const idAddress = id.toString()
    const address = await prisma.address.findMany({
      where: {
        id: idAddress,
      },
    });
    console.log(address);
    return res.json(address);
  }
}