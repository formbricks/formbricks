import { marketingSectionRoute } from "@/modules/settings/lib/marketing-redirect-handler";

// ID-free marketing link /surveys[/...]; see MARKETING_SECTIONS in marketing-redirects.ts.
export const GET = marketingSectionRoute("surveys");
