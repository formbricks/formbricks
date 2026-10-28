import { getLlmsTxt } from "@/modules/agent-setup/llms-txt";
import { getSetupGuideUrls } from "@/modules/agent-setup/urls";

// Carries this instance's own URL from runtime configuration, so it must not be prerendered at build.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return new Response(getLlmsTxt(getSetupGuideUrls()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
    },
  });
}
