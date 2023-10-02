import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import * as z from "zod";
import { connectAirtable } from "@/../../packages/lib/services/airTable";

export async function POST(req: NextRequest) {
  const environmentId = req.headers.get("environmentId");
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ Error: "Invalid session" }, { status: 400 });
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user, environmentId);
  if (!canUserAccessEnvironment || !environmentId) {
    return NextResponse.json({ Error: "You dont have access to environment" }, { status: 401 });
  }

  const body = await req.json();

  const data = z.object({ key: z.string() }).safeParse(body);

  if (!data.success) {
    return NextResponse.json({ Error: "key is required" }, { status: 401 });
  }

  const req_ = await fetch("https://api.airtable.com/v0/meta/whoami", {
    headers: {
      Authorization: `Bearer ${data.data.key}`,
    },
  });

  if (req_.ok) {
    await connectAirtable(environmentId, data.data.key);
    return NextResponse.json({ message: "successfully added Airtable integration" }, { status: 200 });
  }
  return NextResponse.json({ Error: "invalid key" }, { status: 401 });
}
