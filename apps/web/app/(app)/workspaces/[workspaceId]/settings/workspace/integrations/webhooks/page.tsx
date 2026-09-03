import { WebhooksPage } from "@/modules/integrations/webhooks/page";
import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";

export const generateMetadata = () => getSettingsPageMetadata("common.webhooks");

export default WebhooksPage;
