import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const formId = req.query.formId?.toString();
  const submissionId = req.query.submissionId?.toString();

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }

  // PUT /capture/forms/[formId]/submissions/[submissionId]
  // Extend an existing form submission
  // Required fields in body: -
  // Optional fields in body: customerId, data
  else if (req.method === "PUT") {
    // redirect request and make a request to legacy.formbricks.com
    if (process.env.FORMBRICKS_LEGACY_HOST) {
      const response = await fetch(
        `${process.env.FORMBRICKS_LEGACY_HOST}/api/capture/forms/${formId}/submissions/${submissionId}`,
        {
          method: "PUT",
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
