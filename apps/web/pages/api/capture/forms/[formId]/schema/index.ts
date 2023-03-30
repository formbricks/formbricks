import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const formId = req.query.formId?.toString();

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }

  // POST/capture/forms/[formId]/schema
  // Update form schema
  // Required fields in body: -
  // Optional fields in body: customerId, data
  else if (req.method === "POST") {
    if (process.env.FORMBRICKS_LEGACY_HOST) {
      const response = await fetch(
        `${process.env.FORMBRICKS_LEGACY_HOST}/api/capture/forms/${formId}/schema`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.FORMBRICKS_LEGACY_HOST}`,
          },
          body: JSON.stringify(req.body),
        }
      );
      const responseData = await response.json();
      res.json(responseData);
    } else {
      throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
    }
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
