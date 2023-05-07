import { INTERNAL_SECRET } from "@formbricks/lib/constants";
import { prisma } from "@formbricks/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { internalSecret, environmentId, event, data } = await request.json();
  if (!internalSecret) {
    return new Response("Missing internalSecret", {
      status: 400,
    });
  }
  if (!environmentId) {
    return new Response("Missing environmentId", {
      status: 400,
    });
  }
  if (!event) {
    return new Response("Missing event", {
      status: 400,
    });
  }
  if (!data) {
    return new Response("Missing data", {
      status: 400,
    });
  }
  if (internalSecret !== INTERNAL_SECRET) {
    return new Response("Invalid internalSecret", {
      status: 401,
    });
  }

  // get all webhooks of this environment where event in triggers
  const webhooks = await prisma.webhook.findMany({
    where: {
      environmentId,
      triggers: {
        hasSome: event,
      },
    },
  });

  // send request to all webhooks
  await Promise.all(
    webhooks.map(async (webhook) => {
      await fetch(webhook.url, {
        method: "POST",
        body: JSON.stringify({
          event,
          data,
        }),
      });
    })
  );

  return NextResponse.json({ data: {} });
}
