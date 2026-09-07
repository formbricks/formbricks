import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";
import { GeneralSettingsPage } from "@/modules/workspaces/settings/general/page";

export const generateMetadata = () => getSettingsPageMetadata("common.workspace_settings");

export default GeneralSettingsPage;
