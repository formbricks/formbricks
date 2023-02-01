import type { NextApiRequest, NextApiResponse } from "next";

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  // POST/capture/forms/[formId]/submissions
  // Create a new form submission
  // Required fields in body: -
  // Optional fields in body: customerId, data
  if (req.method === "GET") {
    const submissionRequest = await fetch(
      `http://localhost:3000/api/workspaces/cldluasmh0001qfwq6wzzhkqd/forms/cldlz5zxl0012qfwqj5zly1u3/submissions`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-API-Key": "b364435ae5dab956aec1b2b3e753258b" },
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
