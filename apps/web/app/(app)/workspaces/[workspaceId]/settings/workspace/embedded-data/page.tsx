import { EmbeddedDataSettingsPage } from "@/modules/embedded-data/settings/page";
import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";

export const generateMetadata = () => getSettingsPageMetadata("common.embedded_data");

export default EmbeddedDataSettingsPage;
