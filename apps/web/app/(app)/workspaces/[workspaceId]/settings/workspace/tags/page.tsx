import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";
import { TagsPage } from "@/modules/workspaces/settings/tags/page";

export const generateMetadata = () => getSettingsPageMetadata("common.tags");

export default TagsPage;
