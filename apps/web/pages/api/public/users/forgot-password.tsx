import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "database";
import { capturePosthogEvent } from "../../../../lib/posthog";
import { sendForgotPasswordEmail } from "../../../../lib/email";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // POST /api/public/users/forgot-password
  // Sends a reset password email to the user
  // Required fields in body: email
  if (req.method === "POST") {
    const { email } = req.body;

    try {
      const foundUser = await prisma.user.findUnique({
        where: {
          email: email.toLowerCase(),
        },
      });

      if (!foundUser) {
        return res.status(409).json({
          error: "no user with this email found",
        });
      }

      await sendForgotPasswordEmail(foundUser);
      capturePosthogEvent(foundUser.email, "requestedForgotPasswordEmail");
      res.json({});
    } catch (e) {
      return res.status(500).json({
        error: e.message,
        errorCode: e.code,
      });
    }
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
