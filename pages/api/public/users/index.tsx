import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "../../../../lib/prisma";
import { UserRole } from "@prisma/client";
import { sendVerificationEmail } from "../../../../lib/email";
import getConfig from "next/config";
import { capturePosthogEvent } from "../../../../lib/posthog";

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
    let { user, callbackUrl} = req.body;
    user = { ...user, ...{ email: user.email.toLowerCase() } };

    const { emailVerificationDisabled } = publicRuntimeConfig;

    // create user in database
    try {
      const userData = await prisma.user.create({
        data: {
          ...user,
        },
      });
      if (!emailVerificationDisabled) await sendVerificationEmail(userData, callbackUrl);
      capturePosthogEvent(user.email, "user created");
      res.json(userData);
    } catch (e) {
      if (e.code === "P2002") {
        return res.status(409).json({
          error: "un utilisateur avec cette adresse e-mail ou numéro de téléphone existe déjà",
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
  // GET /api/public/users
  else if(req.method === "GET"){
    // Check Authentication and user role
    const session = await getSession({ req: req });
    if (!session) return res.status(401).json({ message: "Not authenticated" });
    
    if(session.user.role === UserRole.PUBLIC) return res.status(403).json({ message: "Forbidden" });
    const usersData = await prisma.user.findMany({
      select:{
        id:true,
        firstname: true,
        lastname: true,
        email: true,
        gender: true,
        phone: true,
        whatsapp: true,
        role: true,
      }
    })
    if (!usersData.length) return res.status(204);
    res.json(usersData); 
    }
  // Unknown HTTP Method
    else {
      throw new Error(
        `The HTTP ${req.method} method is not supported by this route.`
      );
    }
}
