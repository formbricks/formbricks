import { type NextRequest } from "next/server";
import { handleAuthenticatedMcpRequest } from "@/modules/mcp/auth";
import { mcpHandler } from "@/modules/mcp/server";

export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function POST(request: NextRequest): Promise<Response> {
  return await handleAuthenticatedMcpRequest(request, mcpHandler);
}
