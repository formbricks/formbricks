import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { ZStyleGuideCreate } from "@formbricks/types/style-guide";
import { apiWrapper } from "@/app/api/v1/lib/utils";

export const GET = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { organizationId } = params;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    return { error: "Organization not found", status: 404 };
  }

  const styleGuides = await prisma.styleGuide.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return { data: styleGuides };
});

export const POST = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { organizationId } = params;
  const body = await req.json();

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    return { error: "Organization not found", status: 404 };
  }

  const parsedData = ZStyleGuideCreate.parse({
    ...body,
    organizationId,
  });

  const styleGuide = await prisma.styleGuide.create({
    data: parsedData,
  });

  return { data: styleGuide };
});
