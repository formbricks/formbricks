import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";

export const generateMetadata = () => getSettingsPageMetadata("common.embedded_data");

export { EmbeddedDataSettingsPage as default } from "@/modules/embedded-data/settings/page";
