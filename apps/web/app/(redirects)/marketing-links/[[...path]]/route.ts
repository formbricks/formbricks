import { marketingLinksRoute } from "@/modules/settings/lib/marketing-redirect-handler";

// Every ID-free marketing link (/billing, /settings/..., /contacts, ...) is rewritten here by the proxy;
// see MARKETING_SECTIONS in modules/settings/lib/marketing-redirects.ts.
export const GET = marketingLinksRoute;
