"use client";

import { useTranslation } from "react-i18next";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import { getApiKeySnippets, getOAuthSnippets } from "../lib/connect-snippets";

interface AgentConnectTabsProps {
  serverUrl: string;
  /** `oauth` signs in through the browser; `apiKey` sends a key the person already holds. */
  mode: "oauth" | "apiKey";
}

const Snippet = ({ code, language }: Readonly<{ code: string; language: string }>) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 pt-2.5 pb-3.5">
    <CodeBlock noMargin language={language} customEditorClass="pr-8">
      {code}
    </CodeBlock>
  </div>
);

const StepLabel = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <span className="text-sm font-medium text-slate-700">{children}</span>
);

const Hint = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <p className="text-sm text-slate-500">{children}</p>
);

export const AgentConnectTabs = ({ serverUrl, mode }: Readonly<AgentConnectTabsProps>) => {
  const { t } = useTranslation();
  const isOAuth = mode === "oauth";
  const snippets = isOAuth ? getOAuthSnippets(serverUrl) : getApiKeySnippets(serverUrl);
  const exportHint = t("shell.connect.api_key_export_hint");

  return (
    <Tabs defaultValue="claude">
      <TabsList>
        <TabsTrigger value="claude">{t("shell.connect.tabs.claude")}</TabsTrigger>
        <TabsTrigger value="codex">{t("shell.connect.tabs.codex")}</TabsTrigger>
        <TabsTrigger value="cursor">{t("shell.connect.tabs.cursor")}</TabsTrigger>
      </TabsList>

      <TabsContent value="claude" className="flex flex-col gap-3 pt-3">
        <StepLabel>{t("shell.connect.claude_code")}</StepLabel>
        <Snippet code={snippets.claudeCode} language="bash" />
        <Hint>{isOAuth ? t("shell.connect.claude_code_hint") : exportHint}</Hint>
        {isOAuth && (
          <>
            <StepLabel>{t("shell.connect.claude_desktop")}</StepLabel>
            <Hint>{t("shell.connect.claude_desktop_hint")}</Hint>
          </>
        )}
      </TabsContent>

      <TabsContent value="codex" className="flex flex-col gap-3 pt-3">
        <StepLabel>{t("shell.connect.codex_add")}</StepLabel>
        <Snippet code={snippets.codexAdd} language="bash" />
        {isOAuth ? (
          <>
            <StepLabel>{t("shell.connect.codex_sign_in")}</StepLabel>
            <Snippet code={snippets.codexLogin} language="bash" />
            <Hint>{t("shell.connect.codex_hint")}</Hint>
          </>
        ) : (
          <Hint>{exportHint}</Hint>
        )}
      </TabsContent>

      <TabsContent value="cursor" className="flex flex-col gap-3 pt-3">
        <StepLabel>{t("shell.connect.cursor_label")}</StepLabel>
        <Snippet code={snippets.cursor} language="javascript" />
        <Hint>{isOAuth ? t("shell.connect.cursor_hint") : exportHint}</Hint>
      </TabsContent>
    </Tabs>
  );
};
