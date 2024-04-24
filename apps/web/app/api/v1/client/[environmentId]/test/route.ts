import { NextRequest } from "next/server";

import { getEnvironment } from "@formbricks/lib/environment/service";

export async function GET(
  _: NextRequest,
  { params }: { params: { environmentId: string } }
): Promise<Response> {
  const environmentId = params.environmentId;
  console.log("calling endpoint");
  const environment = await getEnvironment(environmentId);

  return Response.json(environment);
}
