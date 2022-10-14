import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../../lib/prisma";
import { getSession } from "next-auth/react";
import { FormWhereClause } from "../../../../../lib/types";
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
  //const { dueDateFilter, nameFilter } = query;

  // GET /api/public/forms/search?search
  // Gets all sourcings for admins and all public for candidates where search
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
      // where: {
      //   name: nameFilter,
      //   whereClause,
      // },
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
    if (!formData.length) {
      return res.status(204);
      res.json(formData);
    }
  }
}
