import { INTERNAL_SECRET } from "@formbricks/lib/constants";
import { createDemoProduct } from "@formbricks/lib/team/service";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { responses } from "@/lib/api/response";

export async function POST(_: Request, { params }: { params: { teamId: string } }) {
  // Check Authentication

  if (headers().get("x-api-key") !== INTERNAL_SECRET) {
    return responses.notAuthenticatedResponse();
  }

  const teamId = params.teamId;
  if (teamId === undefined) {
    return responses.badRequestResponse("Missing teamId");
  }

  try {
    const demoProduct = await createDemoProduct(teamId);
    return NextResponse.json(demoProduct);
  } catch (err) {
    throw new Error(err);
  }
}
