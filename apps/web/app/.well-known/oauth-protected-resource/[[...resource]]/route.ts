import type { NextRequest } from "next/server";
import {
  MCP_PROTECTED_RESOURCE_SCOPES,
  getAuthIssuerUrl,
  getMcpResourceUrl,
} from "@/modules/auth/lib/oauth-urls";

export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const METADATA_CACHE_CONTROL = "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ resource?: string[] }> }
): Promise<Response> {
  const { resource } = await params;
  const requestedResource = resource?.join("/") ?? "";

  if (requestedResource && requestedResource !== "api/mcp") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json(
    {
      resource: getMcpResourceUrl(),
      authorization_servers: [getAuthIssuerUrl()],
      scopes_supported: [...MCP_PROTECTED_RESOURCE_SCOPES],
      bearer_methods_supported: ["header"],
    },
    {
      headers: {
        "Cache-Control": METADATA_CACHE_CONTROL,
      },
    }
  );
}
