import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { auth } from "@/modules/auth/lib/auth";
import { trimScopesForDashboardViewer } from "@/modules/auth/lib/dashboard-viewer-oauth-scopes";
import {
  type TOAuthPublicClient,
  getHostFromUrl,
  isLocalhostHost,
} from "@/modules/auth/lib/oauth-client-metadata";
import { getSession } from "@/modules/auth/lib/session";
import { isDashboardViewerOnly } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { listMcpGrantAccessOptions } from "@/modules/mcp/access-options";
import { getMcpGrantPermissionsForScopes } from "@/modules/mcp/grant";
import { initialMcpGrantAccessDraft } from "@/modules/mcp/grant-access";
import { getInitialMcpGrantPermissions } from "@/modules/mcp/grant-editor";
import { getMcpGrant } from "@/modules/mcp/grant-store";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Logo } from "@/modules/ui/components/logo";
import { OAuthConsentForm } from "./components/OAuthConsentForm";

type TSearchParams = Record<string, string | string[] | undefined>;

const getSearchParam = (searchParams: TSearchParams, key: string): string | null => {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const getCallbackPath = (searchParams: TSearchParams): string => {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }

    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `/account/authorize?${query}` : "/account/authorize";
};

const getRequestedScopes = (scope: string | null): string[] =>
  scope
    ?.split(" ")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const getPublicOAuthClient = async (clientId: string): Promise<TOAuthPublicClient | null> => {
  try {
    return (await auth.api.getOAuthClientPublic({
      query: { client_id: clientId },
      headers: await headers(),
    })) as TOAuthPublicClient;
  } catch {
    return null;
  }
};

const OAuthConsentLogo = ({ label }: Readonly<{ label: string }>) => (
  <div className="mb-6 flex justify-center">
    <Link
      target="_blank"
      href="https://formbricks.com?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=oauth_consent_logo"
      rel="noopener noreferrer"
      aria-label={label}>
      <Logo aria-hidden="true" className="h-8 w-auto" />
    </Link>
  </div>
);

const Page = async ({ searchParams }: Readonly<{ searchParams: Promise<TSearchParams> }>) => {
  const resolvedSearchParams = await searchParams;
  const session = await getSession();
  if (!session?.user) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(getCallbackPath(resolvedSearchParams))}`);
  }

  const t = await getTranslate();
  const clientId = getSearchParam(resolvedSearchParams, "client_id");
  const scope = getSearchParam(resolvedSearchParams, "scope");
  const redirectUri = getSearchParam(resolvedSearchParams, "redirect_uri");
  const redirectHost = getHostFromUrl(redirectUri);
  const isViewer = session?.user ? await isDashboardViewerOnly(session.user.id) : false;
  // A Dashboard viewer can grant dashboards:read and nothing else (ENG-6889); the consent endpoint
  // enforces the same subset, so the page only shows what will actually be granted.
  const requestedScopes = isViewer
    ? trimScopesForDashboardViewer(getRequestedScopes(scope))
    : getRequestedScopes(scope);
  const isViewerGrantEmpty = isViewer && !requestedScopes.includes("dashboards:read");
  const client = clientId ? await getPublicOAuthClient(clientId) : null;

  if (!clientId || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <OAuthConsentLogo label={t("auth.oauth.formbricks_website")} />
          <Alert variant="error" role="status">
            <AlertTitle>{t("auth.oauth.invalid_oauth_request")}</AlertTitle>
            <AlertDescription>{t("auth.oauth.invalid_oauth_request_description")}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const clientName = client.client_name ?? t("auth.oauth.unknown_client");
  // The permission matrix (ENG-7150): capped by what the client asks for, and opening with the
  // connection's existing grant when it has one, so a reconnect doesn't undo a narrower choice.
  const cap = getMcpGrantPermissionsForScopes(requestedScopes);
  // Organization & workspace access (ENG-7153) opens the same way: the existing grant's, else All access.
  const [existingGrant, accessOptions] = session?.user
    ? await Promise.all([getMcpGrant(session.user.id, clientId), listMcpGrantAccessOptions(session.user.id)])
    : [null, { organizations: [], workspaces: [] }];
  const initialPermissions = getInitialMcpGrantPermissions({
    existing: existingGrant?.permissions ?? null,
    cap,
  });
  const initialAccess = initialMcpGrantAccessDraft(existingGrant);
  const identityAccess = [
    ...(requestedScopes.includes("profile") || requestedScopes.includes("email")
      ? [t("auth.oauth.grant.identity_name_and_email")]
      : []),
    ...(requestedScopes.includes("offline_access") ? [t("auth.oauth.grant.identity_stay_signed_in")] : []),
  ];
  const clientUriHost = getHostFromUrl(client.client_uri ?? null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <OAuthConsentLogo label={t("auth.oauth.formbricks_website")} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{t("auth.oauth.authorization_request")}</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t("auth.oauth.authorize_title", { clientName })}
          </h1>
          <p className="text-sm text-slate-600">{t("auth.oauth.authorize_description")}</p>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-slate-900">{t("auth.oauth.client")}</dt>
            <dd className="mt-1 text-slate-600">{clientName}</dd>
          </div>

          {(redirectHost || clientUriHost) && (
            <div>
              <dt className="font-medium text-slate-900">{t("auth.oauth.redirect_host")}</dt>
              <dd className="mt-1 text-slate-600">{redirectHost ?? clientUriHost}</dd>
            </div>
          )}

          {client.client_uri && (
            <div>
              <dt className="font-medium text-slate-900">{t("auth.oauth.client_uri")}</dt>
              <dd className="mt-1 break-all text-slate-600">{client.client_uri}</dd>
            </div>
          )}

          {identityAccess.length > 0 && (
            <div>
              <dt className="font-medium text-slate-900">{t("auth.oauth.grant.always_granted")}</dt>
              <dd className="mt-1 text-slate-600">
                <ul className="list-inside list-disc">
                  {identityAccess.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>

        {isLocalhostHost(redirectHost) && (
          <Alert variant="warning" className="mt-6" role="status">
            <AlertTitle>{t("auth.oauth.localhost_redirect_warning")}</AlertTitle>
            <AlertDescription>{t("auth.oauth.localhost_redirect_warning_description")}</AlertDescription>
          </Alert>
        )}

        {isViewer && (
          <Alert variant={isViewerGrantEmpty ? "error" : "info"} className="mt-6" role="status">
            <AlertTitle>{t("auth.oauth.dashboard_viewer_scope_title")}</AlertTitle>
            <AlertDescription>
              {isViewerGrantEmpty
                ? t("auth.oauth.dashboard_viewer_no_dashboard_scope")
                : t("auth.oauth.dashboard_viewer_scope_description")}
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-6">
          <OAuthConsentForm
            initialPermissions={initialPermissions}
            initialAccess={initialAccess}
            accessOptions={accessOptions}
            cap={cap}
            isDashboardViewer={isViewer}
            grantedScope={isViewer ? requestedScopes.join(" ") : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default Page;
