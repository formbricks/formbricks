import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { prisma } from "../../../../../lib/prisma";
import { UserRole } from "@prisma/client";

// PUT /api/public/users/:id
export default async function updateUserRole (
    req: NextApiRequest,
    res: NextApiResponse
){
    const userId = parseInt(req.query.id.toString());
    const session = await getSession({ req: req });

    if(!session) return res.status(401).json({ message: "Not authenticated" });
    if(session.user.role !== UserRole.ADMIN) return res.status(403).json({ message: "Forbidden" });
    const updatedRole = await prisma.user.update(
        {
            where : {
                id : userId
            },
            data : {
                role : req.body
            },
        }
    ).then(()=>{res.status(200).send({message:"The User's role changed"})})
    .catch((error)=>{res.status(500).send({message:error})})

}