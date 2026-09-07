import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";
import { LanguagesPage } from "@/modules/workspaces/settings/languages/page";

export const generateMetadata = () => getSettingsPageMetadata("common.survey_languages");

export default LanguagesPage;
