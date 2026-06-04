import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { ZStyleGuideCreate } from "@formbricks/types/style-guide";
import { apiWrapper } from "@/app/api/v1/lib/utils";

export const POST = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { organizationId } = params;
  const body = await req.json();

  const parsedData = ZStyleGuideCreate.parse({
    ...body,
    organizationId,
  });

  const styleGuide = await prisma.styleGuide.create({
    data: parsedData,
  });

  return { data: styleGuide };
});

export const GET = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { organizationId } = params;

  const styleGuides = await prisma.styleGuide.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return { data: styleGuides };
});
