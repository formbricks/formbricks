import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import * as z from "zod";
import { connectAirtable } from "@/../../packages/lib/services/airTable";

export async function POST(req: NextRequest) {
  const environmentId = req.headers.get("environmentId");
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ Error: "Invalid session" }, { status: 400 });
  }

  if (!environmentId) {
    return NextResponse.json({ Error: "environmentId is missing" }, { status: 400 });
  }

  const canUserAccessEnvironment = await hasUserEnvironmentAccess(session?.user.id, environmentId);
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
    const res = await req_.json();
    const email = z.string().safeParse(res?.email);

    if (!email.success) {
      return NextResponse.json(
        { Error: "set user.email:read scope for the personal token" },
        { status: 401 }
      );
    }

    await connectAirtable(environmentId, data.data.key, email.data);
    return NextResponse.json({ message: "successfully added airtable integration" }, { status: 200 });
  }
  return NextResponse.json({ Error: "invalid personal access token" }, { status: 401 });
}
