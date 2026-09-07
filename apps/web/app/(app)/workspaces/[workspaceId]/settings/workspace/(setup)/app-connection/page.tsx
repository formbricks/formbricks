import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";
import { AppConnectionPage } from "@/modules/workspaces/settings/(setup)/app-connection/page";

export const generateMetadata = () => getSettingsPageMetadata("common.connect_your_app");

export default AppConnectionPage;
