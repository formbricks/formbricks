import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";
import { WorkspaceLookSettingsPage } from "@/modules/workspaces/settings/look/page";

export const generateMetadata = () => getSettingsPageMetadata("common.appearance");

export default WorkspaceLookSettingsPage;
