import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { UserRole } from "@prisma/client";

// PUT /api/public/users/:id
export default async function updateUserRole(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req: req });

  if (!session) return res.status(401).json({ message: "Not authenticated" });
  if (session.user.role !== UserRole.ADMIN)
    return res.status(403).json({ message: "Forbidden" });
}
