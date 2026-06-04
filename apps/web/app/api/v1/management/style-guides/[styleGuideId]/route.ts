import { NextRequest } from "next/server";
import { prisma } from "@formbricks/database";
import { ZStyleGuideUpdate } from "@formbricks/types/style-guide";
import { apiWrapper } from "@/app/api/v1/lib/utils";

export const GET = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { styleGuideId } = params;

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!styleGuide) {
    return { error: "Style guide not found", status: 404 };
  }

  return { data: styleGuide };
});

export const PATCH = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { styleGuideId } = params;
  const body = await req.json();

  const existingStyleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!existingStyleGuide) {
    return { error: "Style guide not found", status: 404 };
  }

  const parsedData = ZStyleGuideUpdate.parse(body);

  const styleGuide = await prisma.styleGuide.update({
    where: { id: styleGuideId },
    data: parsedData,
  });

  return { data: styleGuide };
});

export const DELETE = apiWrapper(async (req: NextRequest, { params }: any) => {
  const { styleGuideId } = params;

  const styleGuide = await prisma.styleGuide.findUnique({
    where: { id: styleGuideId },
  });

  if (!styleGuide) {
    return { error: "Style guide not found", status: 404 };
  }

  await prisma.styleGuide.delete({
    where: { id: styleGuideId },
  });

  return { data: { success: true } };
});
