import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import NextCors from "nextjs-cors";
 
export default async function handle(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    await NextCors(req, res, {
        // Options
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
        origin: "*",
        optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
      });
    const session = await getSession({ req: req });
         
    if (!session) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (req.method === "PUT") {
        if (session.user.role === UserRole.PUBLIC) return res.status(403).json({ message: "Not Allowed" }) ;
        const {id, role} = req.body;
        let updateUser;
        const newRole = role === "PUBLIC" ? "ADMIN" : "PUBLIC"
            const user = await prisma.user.findUnique({
              where: {
                id,
              },
            });
            if(user) {
                 updateUser = await prisma.user.update({
                    where: {
                      id,
                    },
                    data: {
                        role: newRole
                    }
                  });
            }
        return res.json(updateUser);
      }
  }