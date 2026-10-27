import { parseV3ApiError } from "@/modules/api/lib/v3-client";

/** Reactivate a deactivated member of the organisation; their data retention clock restarts with it. */
export async function reactivateMember({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}): Promise<void> {
  const response = await fetch(
    `/api/internal/members/${encodeURIComponent(userId)}/reactivate?${new URLSearchParams({ organizationId })}`,
    { method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000) }
  );
  if (!response.ok) throw await parseV3ApiError(response);
}
