"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { McpGrantAccessSelector } from "@/modules/mcp/components/mcp-grant-access-selector";
import { McpGrantEditor } from "@/modules/mcp/components/mcp-grant-editor";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import {
  type TMcpGrantAccessDraft,
  type TMcpGrantAccessOptions,
  toMcpGrantAccessSelection,
} from "@/modules/mcp/grant-access";
import { isMcpGrantEmpty } from "@/modules/mcp/grant-editor";
import { OAuthConsentActions } from "./OAuthConsentActions";

interface OAuthConsentFormProps {
  /** What the matrix opens with: the client's existing grant, or what it asked for. */
  readonly initialPermissions: TMcpGrantPermissions;
  /** The organization & workspace access it opens with: the existing grant's, or All access. */
  readonly initialAccess: TMcpGrantAccessDraft;
  /** The user's organizations and workspaces the access picker offers. */
  readonly accessOptions: TMcpGrantAccessOptions;
  /** What the client's scopes ask for; no level above it can be chosen. */
  readonly cap: TMcpGrantPermissions;
  readonly isDashboardViewer: boolean;
  /** The scopes to grant when narrower than the request (a Dashboard viewer's). */
  readonly grantedScope?: string;
}

/** The consent screen's permission matrix and its Allow / Deny, which sends the chosen grant. */
export const OAuthConsentForm = ({
  initialPermissions,
  initialAccess,
  accessOptions,
  cap,
  isDashboardViewer,
  grantedScope,
}: OAuthConsentFormProps) => {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<TMcpGrantPermissions>(initialPermissions);
  const [access, setAccess] = useState<TMcpGrantAccessDraft>(initialAccess);
  const isEmpty = isMcpGrantEmpty(permissions);
  const accessSelection = toMcpGrantAccessSelection(access);

  return (
    <div className="space-y-6">
      <McpGrantAccessSelector
        id="mcp-consent-access"
        value={access}
        options={accessOptions}
        onChange={setAccess}
      />
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
      <OAuthConsentActions
        grantedScope={grantedScope}
        permissions={permissions}
        access={accessSelection}
        isAllowDisabled={isEmpty || accessSelection === null}
      />
    </div>
  );
};
