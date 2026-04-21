import { headers } from "next/headers";
import { logger } from "@formbricks/logger";
import { CRON_SECRET } from "@/lib/constants";
import { runScheduledReminders } from "@/modules/survey/invitations/lib/scheduled-reminders";

// POST /api/cron/reminders
// Auth: header `x-api-key: $CRON_SECRET` (same convention as /api/(internal)/pipeline).
// Expected to be hit by a VM crontab / GitHub Actions / etc. roughly once a day.
export const POST = async (request: Request) => {
  const requestHeaders = await headers();
  // Fail closed when CRON_SECRET is unset: without a shared secret we have no
  // way to authenticate the caller, so refuse rather than silently accept or
  // lock everyone out due to `null !== undefined` being truthy.
  if (!CRON_SECRET || requestHeaders.get("x-api-key") !== CRON_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledReminders();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ error, url: request.url }, "runScheduledReminders failed");
    return Response.json({ ok: false, error: "internal_server_error" }, { status: 500 });
  }
};
