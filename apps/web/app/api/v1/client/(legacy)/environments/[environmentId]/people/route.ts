import { getSettings } from "@/app/lib/api/clientSettings";
import { responses } from "@/app/lib/api/response";
import { createPerson } from "@formbricks/lib/person/service";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(
  _: Request,
  { params }: { params: { environmentId: string } }
): Promise<NextResponse> {
  const { environmentId } = params;

  if (!environmentId) {
    return responses.badRequestResponse(
      "Missing environmentId",
      {
        missing_field: "environmentId",
      },
      true
    );
  }

  try {
    const person = await createPerson(environmentId);
    const settings = await getSettings(environmentId, person.id);

    return responses.successResponse(
      {
        person,
        settings,
      },
      true
    );
  } catch (error) {
    return responses.internalServerErrorResponse(error.message, true);
  }
}
