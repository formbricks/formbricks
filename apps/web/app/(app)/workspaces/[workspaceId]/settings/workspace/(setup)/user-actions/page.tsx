import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";

export const generateMetadata = () => getSettingsPageMetadata("common.user_actions");

export { UserActionsPage as default } from "@/modules/workspaces/settings/(setup)/user-actions/page";
