import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@formbricks/database";
import { sendVerificationEmail } from "@/lib/email";
import { capturePosthogEvent } from "@/lib/posthog";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // POST /api/public/users
  // Creates a new user
  // Required fields in body: email, password (hashed)
  // Optional fields in body: firstname, lastname
  if (req.method === "POST") {
    if (process.env.NEXT_PUBLIC_SIGNUP_DISABLED === "1") {
      res.status(403).json({ error: "Signup disabled" });
      return;
    }
    let user = req.body;
    user = { ...user, ...{ email: user.email.toLowerCase() } };

    // create user in database
    try {
      const userData = await prisma.user.create({
        data: {
          ...user,
          teams: {
            create: [
              {
                accepted: true,
                role: "OWNER",
                team: {
                  create: {
                    name: `${user.name}'s Team`,
                  },
                },
              },
            ],
          },
        },
      });
      if (process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_DISABLED !== "1") await sendVerificationEmail(userData);
      // tracking
      capturePosthogEvent(userData.id, "user created");
      res.json(userData);
    } catch (e) {
      if (e.code === "P2002") {
        return res.status(409).json({
          error: "user with this email address already exists",
          errorCode: e.code,
        });
      } else {
        return res.status(500).json({
          error: e.message,
          errorCode: e.code,
        });
      }
    }
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
