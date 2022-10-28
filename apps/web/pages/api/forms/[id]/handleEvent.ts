import type { NextApiRequest, NextApiResponse } from "next";
import { processApiEvent, validateEvents } from "../../../../lib/apiEvents";

///api/submissionSession
export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const formId = req.query.id.toString();

  // POST /api/forms/:id/schema
  // Updates a form schema
  // Required fields in body: schema
  // Optional fields in body: -
  if (req.method === "POST") {
    const { event } = req.body;
    await processApiEvent(event, formId);
    res.json({ success: true });
  }
  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
