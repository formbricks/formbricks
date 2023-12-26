import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { sendPasswordResetNotifyEmail } from "../../../../lib/email";
import { verifyToken } from "../../../../lib/jwt";

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
      const { id } = await verifyToken(token)
      const user = await prisma.user.findUnique({
        where: {
          id: id,
         
        },
        select: {
          id: true,
          email: true,
          emailVerified: true
        },
      });
      if (!user) {
        return res.status(409).json({
          error: "Jeton invalide fourni ou qui n'est plus valide",
        });
      }
      const emailVerified =  user.emailVerified || new Date().toISOString();
      const  updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, emailVerified }
      })
      // Not important now
      //await sendPasswordResetNotifyEmail(user)
      res.json({ updatedUser });
    } catch (e) {
      return res.status(500).json({
        error: "Jeton invalide fourni ou qui n'est plus valide",
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
