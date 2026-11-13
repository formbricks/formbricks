"use client";

import { useTranslation } from "react-i18next";
import { McpGrantDraftFields } from "@/modules/mcp/components/mcp-grant-draft-fields";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";
import type { TMcpGrantAccessDraft, TMcpGrantAccessOptions } from "@/modules/mcp/grant-access";
import { useMcpGrantDraft } from "@/modules/mcp/hooks/use-mcp-grant-draft";
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
  const draft = useMcpGrantDraft({ permissions: initialPermissions, access: initialAccess }, null);

  return (
    <div className="space-y-6">
      <McpGrantDraftFields
        id="mcp-consent"
        draft={draft}
        accessOptions={accessOptions}
        cap={cap}
        isDashboardViewer={isDashboardViewer}
        emptyHint={t("auth.oauth.grant.empty_grant_hint")}
      />
      <OAuthConsentActions
        grantedScope={grantedScope}
        permissions={draft.permissions}
        access={draft.accessSelection}
        isAllowDisabled={!draft.canSubmit}
      />
    </div>
  );
};
