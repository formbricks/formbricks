import { z } from "zod";
import { V3ApiError, getV3ApiErrorMessage, parseV3ApiError } from "@/modules/api/lib/v3-client";

/**
 * The browser half of "Create organization" in the switcher: it calls `POST /api/v3/organizations`, the
 * same operation the `create_organization` tool runs, so the licence, rate limit and owner rules are the
 * server's and nothing here repeats them. The v3 routes accept the browser session cookie.
 *
 * The page keeps its own pending state around this call: TanStack Query is not a dependency of this app
 * yet, and this is its only caller. It is written as a plain `mutationFn` (a name in, an organization or a
 * thrown `V3ApiError` out), so wrapping it in `useMutation` later is a call-site change.
 */

const ZCreatedOrganization = z.object({ data: z.object({ id: z.string().min(1), name: z.string() }) });

export type TCreatedOrganization = { id: string; name: string };

export async function createOrganization(name: string): Promise<TCreatedOrganization> {
  const response = await fetch("/api/v3/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw await parseV3ApiError(response);

  const parsed = ZCreatedOrganization.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new V3ApiError({
      status: response.status,
      detail: "Unexpected response",
      code: "invalid_response",
    });
  }
  return parsed.data.data;
}

/** Where the person lands after creating one: its Connect page, which shows the setup prompt. */
export const getNewOrganizationPath = (organizationId: string): string =>
  `/organizations/${encodeURIComponent(organizationId)}`;

/**
 * The line shown in the dialog. The server's own detail is shown for a refusal it wrote for the person
 * (403 multi-organization licence, 429 rate limit); anything else, including a network failure or a
 * malformed answer, shows the translated fallback.
 */
export function getCreateOrganizationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof V3ApiError && [400, 403, 429].includes(error.status) && error.detail) {
    return getV3ApiErrorMessage(error, fallback);
  }
  return fallback;
}
