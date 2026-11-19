import { type TMcpGrantPermissions, type TRequestedMcpGrant, isMcpGrantEmpty } from "@/modules/mcp/grant";
import { toMcpGrantAccessRequest } from "@/modules/mcp/grant-access";

type TConsentRequest = {
  /** What the client's scopes ask for. */
  cap: TMcpGrantPermissions;
  isDashboardViewer: boolean;
};

/**
 * Whether the request asks for nothing beyond who the user is (`openid`, `profile`, `email`,
 * `offline_access`): no MCP scope, so no permission matrix and no grant. Allow approves it as it stands,
 * and the consent hooks store the consent without a grant. Never for a Dashboard viewer, who can only
 * approve `dashboards:read`: the consent endpoint refuses a request without it.
 */
export const isIdentityOnlyConsent = ({ cap, isDashboardViewer }: TConsentRequest): boolean =>
  !isDashboardViewer && isMcpGrantEmpty(cap);

/**
 * The body Allow posts to `/oauth2/consent`, beside the signed `oauth_query` the client plugin adds: the
 * scopes to grant when narrower than the request (a Dashboard viewer's), and the grant the user chose
 * (`mcp_grant`, read by the consent hooks in `mcp-grant-consent.ts`). An identity-only request
 * ({@link isIdentityOnlyConsent}) sends no grant: the consent endpoint refuses one that gives no permission.
 */
export const getConsentApprovalBody = ({
  identityOnly,
  grantedScope,
  grant,
}: {
  identityOnly: boolean;
  grantedScope?: string;
  grant: TRequestedMcpGrant;
}): Record<string, unknown> => ({
  accept: true,
  ...(grantedScope ? { scope: grantedScope } : {}),
  ...(identityOnly
    ? {}
    : {
        mcp_grant: {
          permissions: grant.permissions,
          ...(grant.access ? toMcpGrantAccessRequest(grant.access) : {}),
        },
      }),
});
