import { NextResponse } from "next/server";
import { prisma } from "@formbricks/database";
import { responses } from "@/lib/api/response";
import { createPersonWithUser } from "@/lib/api/clientPerson";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return responses.badRequestResponse("Fields are missing or incorrectly formatted", { userId: "" }, true);
  }
  const environmentId = searchParams.get("environmentId");
  if (!environmentId) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      { environmentId: "" },
      true
    );
  }

  const person = await prisma.person.findFirst({
    where: {
      environmentId,
      attributes: {
        some: {
          attributeClass: {
            name: "userId",
          },
          value: userId,
        },
      },
    },
    select: {
      id: true,
      environmentId: true,
    },
  });

  if (!person) {
    const newPerson = await createPersonWithUser(environmentId, userId);
    return responses.successResponse({ person: newPerson }, true);
  }
  return responses.successResponse({ person }, true);
}
