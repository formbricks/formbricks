import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { sendVerificationEmail } from "../../../../lib/email";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST /api/public/users/verification-email
  // Sends a new verification email to a user with a specific email address
  // Required fields in body: email
  if (req.method === "POST") {
    const { email, callbackUrl } = req.body;
    // create user in database
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        return res.status(404).json({
          error: "Aucun utilisateur avec cette adresse e-mail n'a été trouvé",
        });
      }
      if (user.emailVerified) {
        return res.status(400).json({
          error: "L'adresse e-mail a déjà été vérifiée",
        });
      }
      await sendVerificationEmail(user, callbackUrl);
      res.json(user);
    } catch (e) {
      return res.status(500).json({
        error: e.message,
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
