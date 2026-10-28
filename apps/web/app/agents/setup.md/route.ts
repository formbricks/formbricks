import { getSetupGuide } from "@/modules/agent-setup/setup-guide";
import { getSetupGuideUrls } from "@/modules/agent-setup/urls";

// The text carries this instance's own URL from runtime configuration, so it must not be prerendered at build.
export const dynamic = "force-dynamic";

/** Public on purpose: the paste prompt works in any agent, including before the MCP server is connected. */
const SETUP_GUIDE_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=60";

export async function GET(): Promise<Response> {
  return new Response(getSetupGuide(getSetupGuideUrls()), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": SETUP_GUIDE_CACHE_CONTROL,
    },
  });
}
