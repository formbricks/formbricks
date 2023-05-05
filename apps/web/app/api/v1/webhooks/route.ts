import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";
import { hashApiKey } from "@/lib/api/apiHelper";

export async function GET() {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return new Response("Not authenticated. This route is only available via API-Key authorization", {
      status: 401,
    });
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
    return new Response("Not authenticated", {
      status: 401,
    });
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
    return new Response("Not authenticated. This route is only available via API-Key authorization", {
      status: 401,
    });
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
    return new Response("Not authenticated", {
      status: 401,
    });
  }
  const { url, triggers } = await request.json();
  if (!url) {
    return new Response("Missing url", {
      status: 400,
    });
  }

  if (!triggers || !triggers.length) {
    return new Response("Missing triggers", {
      status: 400,
    });
  }

  // add webhook to database
  const webhook = await prisma.webhook.create({
    data: {
      url,
      triggers,
      environment: {
        connect: {
          id: apiKeyData.environmentId,
        },
      },
    },
  });
  return NextResponse.json({ data: webhook });
}
