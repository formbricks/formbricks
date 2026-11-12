"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { McpGrantEditor } from "@/modules/mcp/components/mcp-grant-editor";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import { isMcpGrantEmpty } from "@/modules/mcp/grant-editor";
import { OAuthConsentActions } from "./OAuthConsentActions";

interface OAuthConsentFormProps {
  /** What the matrix opens with: the client's existing grant, or what it asked for. */
  readonly initialPermissions: TMcpGrantPermissions;
  /** What the client's scopes ask for; no level above it can be chosen. */
  readonly cap: TMcpGrantPermissions;
  readonly isDashboardViewer: boolean;
  /** The scopes to grant when narrower than the request (a Dashboard viewer's). */
  readonly grantedScope?: string;
}

/** The consent screen's permission matrix and its Allow / Deny, which sends the chosen grant. */
export const OAuthConsentForm = ({
  initialPermissions,
  cap,
  isDashboardViewer,
  grantedScope,
}: OAuthConsentFormProps) => {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<TMcpGrantPermissions>(initialPermissions);
  const isEmpty = isMcpGrantEmpty(permissions);

  return (
    <div className="space-y-4">
      <McpGrantEditor
        id="mcp-consent-grant"
        permissions={permissions}
        cap={cap}
        isDashboardViewer={isDashboardViewer}
        onChange={setPermissions}
      />
      {isEmpty && (
        <output className="block text-sm text-slate-600">{t("auth.oauth.grant.empty_grant_hint")}</output>
      )}
      <OAuthConsentActions grantedScope={grantedScope} permissions={permissions} isAllowDisabled={isEmpty} />
    </div>
  );
};
