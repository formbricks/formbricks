import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { prisma } from "../../../../lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST /api/public/users/reset-password
  // Resets a users password
  // Required fields in body: token, hashedPassword
  if (req.method === "POST") {
    const { token, hashedPassword } = req.body;

    try {
      const { id } = await jwt.decode(token);
      const user = await prisma.user.findUnique({
        where: {
          id: id,
        },
      });
      if (!user) {
        return res.status(409).json({
          error: "Invalid token provided or no longer valid",
        });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      })
      res.json({});
    } catch (e) {
      return res.status(500).json({
        error: "Invalid token provided or no longer valid",
      });
    }
  }

  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
