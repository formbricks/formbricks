import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "next-auth/react";
// import { FormWhereClause } from "../../../../../lib/types";
import { UserRole } from "@prisma/client";


export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Check Authentication
  const session = await getSession({ req: req });
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const query = req.query;  

  // GET /api/public/forms/search?name=query
  // Gets all sourcings for admins and all public for candidates where search
  if (req.method === "GET") {

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const formData = await prisma.form.findMany({
      where: {
        noCodeForm: { published: true },
        name:{
          contains: `${query.name}`,
        }
      },
      include: {
        owner: {
          select: { firstname: true, lastname: true },
        },
        noCodeForm: {
          select: { published: true, blocks: true },
        },
        _count: {
          select: { submissionSessions: true },
        },
      },
    });
    console.log("RESPONSE : ", formData);
    
    if (!formData.length) {
      return res.status(204).json(formData);
      
    }
    return res.status(200).json(formData);
  }
}
