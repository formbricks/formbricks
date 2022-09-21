import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getSession } from "next-auth/react";
import { generateId, isNotAdmin, isAdmin } from "../../../lib/utils";
import { capturePosthogEvent } from "../../../lib/posthog";
import { UserRole } from "@prisma/client";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check Authentication
  const session = await getSession({ req: req });
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // GET /api/forms
  // Gets all forms of a user
  if (req.method === "GET") {
    //TODO : query Nocodeforms
    const formData = await prisma.form.findMany({
      
      include: {
        owner: {
          select: { firstname: true },
        },
        noCodeForm:{
          select:{published:true}
        },
        _count: {
          select: { submissionSessions: true },
        },
      },
    });
    
    if(!formData.length) return res.status(204)
    res.json(formData.filter((f)=>f.noCodeForm.published));
  }

  // POST /api/forms
  // Creates a new form
  // Required fields in body: -
  // Optional fields in body: title, elements, elementsDraft
  else if (req.method === "POST") {
    const form = req.body;
    const session = await getSession({ req });
    //isNotAdmin(session, res)
    //if(!isAdmin(session)) console.log("Erreur 403");

    if(session.user.role!=="ADMIN"){
      console.log(`The user ${session.user.email} isn't authorised`);
      return res.status(403).json({message: "Unauthorized"})
    }

// get unique alphanumeric ID
    let validId = false;
    let id;
    while (!validId) {
      id = generateId(8);
      validId = await checkIdAvailability(id);
    }
    // create form in database
    const result = await prisma.form.create({
      data: {
        ...form,
        id,
        owner: { connect: { email: session?.user?.email } },
      },
    });
    capturePosthogEvent(session.user.email, "form created", {
      formType: form.formType,
    });
     res.json(result);
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}

const checkIdAvailability = async (id) => {
  const form = await prisma.form.findUnique({
    where: { id },
  });
  if (form === null) {
    return true;
  } else {
    return false;
  }
};

