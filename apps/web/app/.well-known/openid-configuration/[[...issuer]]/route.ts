import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/modules/auth/lib/auth";

export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const handler = oauthProviderOpenIdConfigMetadata(auth, {
  headers: {
    "Cache-Control": "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400",
  },
});

export const GET = handler;
