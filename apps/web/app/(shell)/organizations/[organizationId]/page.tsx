import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { ShellPage, ShellPageHeader } from "@/modules/shell/components/shell-page";
import { AgentConnectTabs } from "@/modules/shell/connect/components/agent-connect-tabs";
import { canManageApiKeys, countAgentConnections } from "@/modules/shell/connections/lib/load-connections";
import { getShellData } from "@/modules/shell/lib/shell-data";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { IdBadge } from "@/modules/ui/components/id-badge";

/** Connect your agent: the organization's landing page, since agents are how Formbricks is used. */
const ConnectAgentPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await getShellData(organizationId);

  // A finance seat: billing is the only organization page it may open.
  if (shell.isBilling) {
    return redirect(`/organizations/${organizationId}/billing`);
  }

  const [t, connectionCount, mayCreateApiKey] = await Promise.all([
    getTranslate(),
    countAgentConnections(organizationId, shell.user.id),
    canManageApiKeys(shell.user.id, organizationId),
  ]);
  const serverUrl = getMcpResourceUrl();
  const connectionsHref = `/organizations/${organizationId}/connections`;

  return (
    <ShellPage>
      <ShellPageHeader title={t("shell.connect.title")} lead={t("shell.connect.lead")} />

      {connectionCount === 0 ? (
        <Alert variant="info" role="status">
          <AlertTitle>{t("shell.connect.none_title")}</AlertTitle>
          <AlertDescription>{t("shell.connect.none_description")}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="default" role="status">
          <AlertTitle>{t("shell.connect.some_title")}</AlertTitle>
          <AlertDescription>{t("shell.connect.some_description")}</AlertDescription>
          <AlertButton asChild>
            <Link href={connectionsHref}>{t("shell.connect.some_cta")}</Link>
          </AlertButton>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("shell.connect.step_add_title")}</CardTitle>
          <CardDescription>{t("shell.connect.step_add_description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <IdBadge
            id={serverUrl}
            label={t("shell.connect.server_url")}
            variant="column"
            className="max-w-full text-left break-all"
          />
          <AgentConnectTabs serverUrl={serverUrl} mode="oauth" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("shell.connect.step_approve_title")}</CardTitle>
          <CardDescription>{t("shell.connect.step_approve_description")}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("shell.connect.step_check_title")}</CardTitle>
          <CardDescription>{t("shell.connect.step_check_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 pt-2.5 pb-3.5">
            <CodeBlock noMargin language="text" customEditorClass="pr-8">
              {t("shell.connect.check_prompt")}
            </CodeBlock>
          </div>
        </CardContent>
      </Card>

      {mayCreateApiKey && (
        <Alert variant="default" role="status">
          <AlertTitle>{t("shell.connect.api_key_title")}</AlertTitle>
          <AlertDescription>{t("shell.connect.api_key_description")}</AlertDescription>
          <AlertButton asChild>
            <Link href={`${connectionsHref}?create=1`}>{t("shell.connect.api_key_cta")}</Link>
          </AlertButton>
        </Alert>
      )}
    </ShellPage>
  );
};

export default ConnectAgentPage;
