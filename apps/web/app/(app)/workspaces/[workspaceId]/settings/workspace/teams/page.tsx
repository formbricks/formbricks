import { WorkspaceTeams } from "@/modules/ee/teams/workspace-teams/page";
import { getSettingsPageMetadata } from "@/modules/settings/lib/metadata";

export const generateMetadata = () => getSettingsPageMetadata("common.team_access");

export default WorkspaceTeams;
