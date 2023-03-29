import { createPerson } from "@/lib/api/clientPerson";
import { createSession } from "@/lib/api/clientSession";
import { getSettings } from "@/lib/api/clientSettings";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return res.status(400).json({ message: "Missing environmentId" });
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }
  // POST
  else if (req.method === "POST") {
    const person = await createPerson(environmentId);
    const session = await createSession(person.id);
    const settings = await getSettings(environmentId, person.id);

    return res.json({ person, session, settings });
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
