import { redirect } from "next/navigation";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { getWorkspacesByOrganizationId } from "@/modules/organization/settings/api-keys/lib/workspaces";
import { ShellPage, ShellPageHeader } from "@/modules/shell/components/shell-page";
import { ConnectionsTable } from "@/modules/shell/connections/components/connections-table";
import { CreateConnectionButton } from "@/modules/shell/connections/components/create-connection-dialog";
import { canManageApiKeys, loadAgentConnections } from "@/modules/shell/connections/lib/load-connections";
import { getShellData } from "@/modules/shell/lib/shell-data";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

/**
 * Agent connections: every API key of the organization and the signed-in person's own OAuth approvals in
 * one list, each revocable. Creating an API key lives here too, as a dialog.
 */
const AgentConnectionsPage = async ({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ create?: string }>;
}>) => {
  const { organizationId } = await params;
  const { create } = await searchParams;
  const shell = await getShellData(organizationId);

  // A finance seat: billing is the only organization page it may open.
  if (shell.isBilling) {
    return redirect(`/organizations/${organizationId}/billing`);
  }

  const [t, locale, rows, mayCreateApiKey] = await Promise.all([
    getTranslate(),
    getLocale(),
    loadAgentConnections(organizationId, shell.user.id),
    canManageApiKeys(shell.user.id, organizationId),
  ]);
  // Same cached call as the loader's, only made when there is a dialog to fill.
  const workspaces = mayCreateApiKey ? await getWorkspacesByOrganizationId(organizationId) : [];

  return (
    <ShellPage>
      <ShellPageHeader
        title={t("shell.connections.title")}
        lead={t("shell.connections.lead")}
        cta={
          mayCreateApiKey && (
            <CreateConnectionButton
              organizationId={organizationId}
              workspaces={workspaces}
              serverUrl={getMcpResourceUrl()}
              initialOpen={create === "1"}
            />
          )
        }
      />

      <Alert variant="info" role="status">
        <AlertTitle>{t("shell.connections.info_title")}</AlertTitle>
        <AlertDescription>{t("shell.connections.info_description")}</AlertDescription>
      </Alert>

      {rows.length > 0 ? (
        <ConnectionsTable rows={rows} locale={locale} />
      ) : (
        <div className="flex flex-col gap-1 rounded-lg border border-slate-200 px-4 py-10 text-center">
          <p className="font-medium text-slate-800">{t("shell.connections.empty_title")}</p>
          <p className="text-slate-500">{t("shell.connections.empty_description")}</p>
        </div>
      )}

      <p className="text-xs text-slate-500">{t("shell.connections.oauth_scope_note")}</p>
    </ShellPage>
  );
};

export default AgentConnectionsPage;
