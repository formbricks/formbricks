import { headers } from "next/headers";

export async function getClientIpFromHeaders(): Promise<string> {
  const headersList = await headers();

  // Try common proxy headers first
  const cfConnectingIp = headersList.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;

  const xForwardedFor = headersList.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();

  // Fallback (may be undefined or localhost in dev)
  return headersList.get("x-real-ip") || "::1"; // NOSONAR - We want to fallback when the result is ""
}
