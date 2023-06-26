import { NextResponse } from "next/server";
import { prisma } from "@formbricks/database";
import { responses } from "@/lib/api/response";
import { createPersonWithUser } from "@/lib/api/clientPerson";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams, pathname } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return responses.badRequestResponse("Fields are missing or incorrectly formatted", { userId: "" }, true);
  }
  const person = await prisma.person.findFirst({
    where: {
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
  const environmentId = getEnvironmentIdFromPath(pathname);

  if (!person && environmentId) {
    const newPerson = await createPersonWithUser(environmentId, userId);
    return responses.successResponse({ person: newPerson }, true);
  }
  return responses.successResponse({ person }, true);
}

function getEnvironmentIdFromPath(path: string): string | null {
  const environmentIdRegex = /\/environments\/([^/]+)/;
  const match = path.match(environmentIdRegex);
  return (match && match[1]) || null;
}
