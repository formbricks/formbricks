import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";
import NextCors from "nextjs-cors";
import { handlePhoneNumberValidity } from "../../../lib/utils";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await NextCors(req, res, {
    // Options
    methods: ["PUT"],
    origin: "*",
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  });
  const session = await getSession({ req: req });

  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.method === "PUT") {
    const { user, address } = req.body;

    Object.keys(user).forEach((attr) => {
      if (user[attr] && ["whatsapp", "phone"].includes(attr)) {
        let number = user[attr].replace(/[^0-9+]/g, "");
        if (attr === "phone")
          user[attr] = handlePhoneNumberValidity(number, attr);
        if (attr === "whatsapp") {
          if (/^[+]\d{5,15}/.test(number)) user[attr] = number;
          else throw new Error(`${attr}: Entrez un numéro valide`);
        }
      } else if (user[attr] && !["id", "profileIsValid"].includes(attr))
        user[attr] = user[attr].trim();
    });

    Object.keys(address).forEach((attr) => {
      if (address[attr]) address[attr] = address[attr].trim();
    });

    const updatedUser = await prisma.user.update({
      select: {
        firstname: true,
        lastname: true,
        phone: true,
        dob: true,
        whatsapp: true,
        address: true,
        profileIsValid: true
      },
      where: {
        id: user.id,
      },
      data: {
        ...user,
        profileIsValid: true,
        address: {
          upsert: {
            create: address,
            update: address,
          },
        },
      },
    });

    return res.json(updatedUser);
  }
}
