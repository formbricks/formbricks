import { prisma } from "@formbricks/database";
import type { NextApiRequest } from "next";
import { CustomNextApiResponse, responses } from "../../../../../../../../lib/api/response";

export default async function handle(req: NextApiRequest, res: CustomNextApiResponse) {
  const environmentId = req.query.environmentId?.toString();

  if (!environmentId) {
    return responses.missingFieldResponse(res, "environmentId");
  }

  const displayId = req.query.displayId?.toString();

  if (!displayId) {
    return responses.missingFieldResponse(res, "displayId");
  }

  // CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
  }

  // POST
  else if (req.method === "POST") {
    // create new response
    await prisma.display.update({
      where: {
        id: displayId,
      },
      data: {
        status: "responded",
      },
    });

    return res.status(201).end();
  }

  // Unknown HTTP Method
  else {
    return responses.methodNotAllowedResponse(res, ["POST", "OPTIONS"]);
  }
}
