import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";
import { hashApiKey } from "@/lib/api/apiHelper";
import { responses } from "@/lib/api/response";

export async function GET() {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await prisma.apiKey.findUnique({
    where: {
      hashedKey: hashApiKey(apiKey),
    },
    select: {
      environmentId: true,
    },
  });
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }

  // add webhook to database
  const webhooks = await prisma.webhook.findMany({
    where: {
      environmentId: apiKeyData.environmentId,
    },
  });
  return NextResponse.json({ data: webhooks });
}

export async function POST(request: Request) {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await prisma.apiKey.findUnique({
    where: {
      hashedKey: hashApiKey(apiKey),
    },
    select: {
      environmentId: true,
    },
  });
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }
  const { url, trigger } = await request.json();
  if (!url) {
    return responses.missingFieldResponse("url");
  }

  if (!trigger) {
    return responses.missingFieldResponse("trigger");
  }

  // add webhook to database
  const webhook = await prisma.webhook.create({
    data: {
      url,
      triggers: [trigger],
      environment: {
        connect: {
          id: apiKeyData.environmentId,
        },
      },
    },
  });
  return responses.successResponse(webhook);
}
