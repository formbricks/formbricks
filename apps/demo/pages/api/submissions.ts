import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // POST/capture/forms/[formId]/submissions
  // Create a new form submission
  // Required fields in body: -
  // Optional fields in body: customerId, data
  if (req.method === "GET") {
    const submissionRequest = await fetch(
      `http://localhost:3000/api/teams/clbdr4dp10001yztzqa9xdvyy/forms/clbgle5og0001yzltkc6iah7i/submissions`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-API-Key": "83c7e175fe2155d9f02998396c23ee18" },
      }
    );
    const submissions = await submissionRequest.json();
    res.json(submissions);
  }

  // Unknown HTTP Method
  else {
    throw new Error(`The HTTP ${req.method} method is not supported by this route.`);
  }
}
