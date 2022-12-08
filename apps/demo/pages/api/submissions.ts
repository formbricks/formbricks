import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // POST/capture/forms/[formId]/submissions
  // Create a new form submission
  // Required fields in body: -
  // Optional fields in body: customerId, data
  if (req.method === "GET") {
    const submissionRequest = await fetch(
      `http://localhost:3000/api/teams/clb27pm870003yz0j496gege0/forms/clb4yr1m90000yzacrgaxfq53/submissions`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-API-Key": "82967fcd502abc9ff213cf9daca9bc43" },
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
