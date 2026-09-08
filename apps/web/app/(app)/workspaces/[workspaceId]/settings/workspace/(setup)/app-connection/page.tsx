import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";
import { AppConnectionPage } from "@/modules/workspaces/settings/(setup)/app-connection/page";

export const generateMetadata = () => getSettingsPageMetadata("common.web_and_mobile_sdk");

export default AppConnectionPage;
