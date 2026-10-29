import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "@/lib/cn";
import { getTranslate } from "@/lingodotdev/server";
import { getSetupGuideUrl } from "@/modules/agent-setup/urls";
import { getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { ShellPage, ShellPageHeader } from "@/modules/shell/components/shell-page";
import { AgentConnectTabs } from "@/modules/shell/connect/components/agent-connect-tabs";
import {
  type TConnectNotice,
  type TConnectSection,
  type TConnectSectionId,
  getConnectLayout,
} from "@/modules/shell/connect/lib/connect-layout";
import { countOrganizationWorkspaces } from "@/modules/shell/connect/lib/organization-workspace-count";
import { canManageApiKeys, countAgentConnections } from "@/modules/shell/connections/lib/load-connections";
import { getShellData } from "@/modules/shell/lib/shell-data";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { IdBadge } from "@/modules/ui/components/id-badge";

const PromptBox = ({ children }: Readonly<{ children: string }>) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 pt-2.5 pb-3.5">
    <CodeBlock noMargin language="text" customEditorClass="pr-8">
      {children}
    </CodeBlock>
  </div>
);

/** Connect your agent: the organization's landing page, since agents are how Formbricks is used. */
const ConnectAgentPage = async ({ params }: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const shell = await getShellData(organizationId);

  // A finance seat: billing is the only organization page it may open.
  if (shell.isBilling) {
    return redirect(`/organizations/${organizationId}/billing`);
  }

  const [t, connectionCount, workspaceCount, mayCreateApiKey] = await Promise.all([
    getTranslate(),
    countAgentConnections(organizationId, shell.user.id),
    countOrganizationWorkspaces(organizationId),
    canManageApiKeys(shell.user.id, organizationId),
  ]);
  const serverUrl = getMcpResourceUrl();
  const setupPrompt = t("shell.connect.setup_prompt", { url: getSetupGuideUrl() });
  const connectionsHref = `/organizations/${organizationId}/connections`;
  const layout = getConnectLayout(connectionCount, workspaceCount);

  const stepPrefix = (step: number | null) => (step ? `${step}. ` : "");

  const sections: Record<TConnectSectionId, (section: TConnectSection) => React.ReactNode> = {
    connect: (section) => (
      <Card key="connect">
        <CardHeader>
          <CardTitle className={cn("text-base", section.emphasis === "secondary" && "text-slate-700")}>
            {stepPrefix(section.step)}
            {layout.hasAgent
              ? t("shell.connect.part_connect_more_title")
              : t("shell.connect.part_connect_title")}
          </CardTitle>
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
          <div className="flex flex-col gap-1 pt-2">
            <span className="text-sm font-medium text-slate-700">
              {t("shell.connect.step_approve_title")}
            </span>
            <p className="text-sm text-slate-500">{t("shell.connect.step_approve_description")}</p>
          </div>
        </CardContent>
      </Card>
    ),
    setup: (section) => (
      <Card key="setup">
        <CardHeader>
          <CardTitle className={cn("text-base", section.emphasis === "secondary" && "text-slate-700")}>
            {stepPrefix(section.step)}
            {t("shell.connect.part_setup_title")}
          </CardTitle>
          <CardDescription>
            {layout.hasAgent
              ? t("shell.connect.part_setup_description")
              : t("shell.connect.part_setup_description_waiting")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <PromptBox>{setupPrompt}</PromptBox>
          <p className="text-sm text-slate-500">{t("shell.connect.setup_prompt_hint")}</p>
          <div className="flex flex-col gap-1 pt-2">
            <span className="text-sm font-medium text-slate-700">{t("shell.connect.check_title")}</span>
            <p className="text-sm text-slate-500">{t("shell.connect.check_description")}</p>
          </div>
          <PromptBox>{t("shell.connect.check_prompt")}</PromptBox>
        </CardContent>
      </Card>
    ),
  };

  const notices: Record<TConnectNotice, React.ReactNode> = {
    new_organization: (
      <Alert variant="info" role="status">
        <AlertTitle>{t("shell.connect.new_organization_title")}</AlertTitle>
        <AlertDescription>{t("shell.connect.new_organization_description")}</AlertDescription>
      </Alert>
    ),
    agent_connected: (
      <Alert variant="default" role="status">
        <AlertTitle>{t("shell.connect.some_title")}</AlertTitle>
        <AlertDescription>{t("shell.connect.some_description")}</AlertDescription>
        <AlertButton asChild>
          <Link href={connectionsHref}>{t("shell.connect.some_cta")}</Link>
        </AlertButton>
      </Alert>
    ),
    no_agent: (
      <Alert variant="info" role="status">
        <AlertTitle>{t("shell.connect.none_title")}</AlertTitle>
        <AlertDescription>{t("shell.connect.none_description")}</AlertDescription>
      </Alert>
    ),
  };

  return (
    <ShellPage>
      <ShellPageHeader title={t("shell.connect.title")} lead={t("shell.connect.lead")} />

      {notices[layout.notice]}

      {layout.sections.map((section) => sections[section.id](section))}

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
