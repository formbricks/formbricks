import { headers } from "next/headers";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";
import { hashApiKey } from "@/lib/api/apiHelper";

export async function GET(_: Request, { params }: { params: { webhookId: string } }) {
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
  const webhook = await prisma.webhook.findUnique({
    where: {
      id: params.webhookId,
    },
  });
  if (!webhook) {
    return new Response("Webhook not found", {
      status: 404,
    });
  }
  return NextResponse.json({ data: webhook });
}

export async function DELETE(_: Request, { params }: { params: { webhookId: string } }) {
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
  const webhook = await prisma.webhook.delete({
    where: {
      id: params.webhookId,
    },
  });
  if (!webhook) {
    return new Response("Webhook not found", {
      status: 404,
    });
  }
  return NextResponse.json({ data: webhook });
}
