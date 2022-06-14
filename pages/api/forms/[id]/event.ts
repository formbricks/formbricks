import type { NextApiRequest, NextApiResponse } from "next";
import NextCors from "nextjs-cors";
import { processApiEvent, validateEvents } from "../../../../lib/apiEvents";

///api/submissionSession
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

  const formId = req.query.id.toString();

  // POST /api/forms/:id/schema
  // Updates a form schema
  // Required fields in body: schema
  // Optional fields in body: -
  if (req.method === "POST") {
    const { events } = req.body;
    const error = validateEvents(events);
    if (error) {
      console.log(JSON.stringify(error, null, 2));
      const { status, message } = error;
      return res.status(status).json({ error: message });
    }
    res.json({ success: true });
    for (const event of events) {
      processApiEvent(event, formId);
    }
  }
  // Unknown HTTP Method
  else {
    throw new Error(
      `The HTTP ${req.method} method is not supported by this route.`
    );
  }
}
