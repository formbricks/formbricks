import Link from "next/link";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { AskYourAgent } from "@/modules/shell/components/ask-your-agent";
import { OrganizationHeader } from "@/modules/shell/components/organization-header";
import { ShellPage } from "@/modules/shell/components/shell-page";
import { RolesReference } from "@/modules/shell/organization/components/roles-reference";
import { SectionHeading } from "@/modules/shell/organization/components/section-heading";
import { TeamsTable } from "@/modules/shell/organization/components/teams-table";
import { requireNonBillingRole } from "@/modules/shell/organization/lib/restricted-section";
import { getTeamDirectory } from "@/modules/shell/organization/lib/team-directory";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

const TeamsPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await requireNonBillingRole(organizationId);
  const t = await getTranslate();

  const isOwnerOrManager = shell.isOwner || shell.isManager;
  const isAccessControlAllowed = await getAccessControlPermission(organizationId);

  const teams = isAccessControlAllowed
    ? await getTeamDirectory(organizationId, shell.user.id, isOwnerOrManager)
    : [];
  // Teams are the agent's to change now. It may act for an owner or manager, and for a team's own admin on
  // that team, so the prompts show for exactly the people whose agent could do it.
  const canManageSomeTeam = isOwnerOrManager || teams.some((team) => team.viewerRole === "admin");

  return (
    <ShellPage>
      <div className="overflow-x-auto">
        <OrganizationHeader organizationId={organizationId} activeId="teams" isBilling={shell.isBilling} />
      </div>

      <SectionHeading title={t("common.teams")} description={t("shell.organization.teams.description")} />

      {isAccessControlAllowed && isOwnerOrManager && (
        <AskYourAgent
          description={t("shell.organization.teams.ask_agent_create")}
          prompt={t("shell.organization.teams.ask_agent_create_prompt")}
        />
      )}

      {isAccessControlAllowed ? (
        teams.length > 0 ? (
          <TeamsTable teams={teams} isOwnerOrManager={isOwnerOrManager} />
        ) : (
          <p className="rounded-xl border border-slate-200 p-6 text-center text-slate-500">
            {t("shell.organization.teams.empty")}
          </p>
        )
      ) : (
        <Alert variant="info" role="status">
          <AlertTitle>{t("shell.organization.teams.locked_title")}</AlertTitle>
          <AlertDescription>{t("shell.organization.teams.locked_description")}</AlertDescription>
          <AlertButton asChild>
            {IS_FORMBRICKS_CLOUD ? (
              <Link href={`/organizations/${organizationId}/billing`}>{t("common.upgrade_plan")}</Link>
            ) : (
              <a href={ENTERPRISE_LICENSE_REQUEST_FORM_URL} target="_blank" rel="noopener noreferrer">
                {t("common.request_trial_license")}
              </a>
            )}
          </AlertButton>
        </Alert>
      )}

      {isAccessControlAllowed && canManageSomeTeam && teams.length > 0 && (
        <AskYourAgent
          description={t("shell.organization.teams.ask_agent_edit")}
          prompt={t("shell.organization.teams.ask_agent_edit_prompt")}
        />
      )}

      <RolesReference isFormbricksCloud={IS_FORMBRICKS_CLOUD} />
    </ShellPage>
  );
};

export default TeamsPage;
