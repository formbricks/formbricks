import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../../../lib/email";
import { prisma } from "../../../../lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST /api/public/users
  // Creates a new user
  // Required fields in body: email, password (hashed)
  // Optional fields in body: firstname, lastname
  if (req.method === "POST") {
    const user = req.body;
    // create user in database
    try {
      const result = await prisma.user.create({
        data: {
          ...user,
        },
      });
      const { id, email } = result;
      const token = jwt.sign({ id }, process.env.SECRET + email, {
        expiresIn: "1d",
      });
      const verifyLink = `${
        process.env.NEXTAUTH_URL
      }/auth/verify?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: user.email,
        subject: "Welcome to snoopForms",
        html: `Welcome to snoopForms!<br/>Please click this link to verify your account: <a href="${verifyLink}">${verifyLink}</a>`,
      });
      res.json(result);
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
