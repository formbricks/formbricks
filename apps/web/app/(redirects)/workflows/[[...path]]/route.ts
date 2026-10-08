import { marketingSectionRoute } from "@/modules/settings/lib/marketing-redirect-handler";

// ID-free marketing link /workflows[/...]; see MARKETING_SECTIONS in marketing-redirects.ts.
export const GET = marketingSectionRoute("workflows");
