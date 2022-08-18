import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { sendVerificationEmail } from "../../../../lib/email";
import getConfig from "next/config";
import { caputurePosthogEvent } from "../../../../lib/posthog";

const { publicRuntimeConfig } = getConfig();

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST /api/public/users
  // Creates a new user
  // Required fields in body: email, password (hashed)
  // Optional fields in body: firstname, lastname
  if (req.method === "POST") {
    let user = req.body;
    user = { ...user, ...{ email: user.email.toLowerCase() } }

    const { emailVerificationDisabled } = publicRuntimeConfig;

    // create user in database
    try {
      const userData = await prisma.user.create({
        data: {
          ...user,
        },
      });
      if (!emailVerificationDisabled) await sendVerificationEmail(userData);
      caputurePosthogEvent(user.email, "userCreated");
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
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
