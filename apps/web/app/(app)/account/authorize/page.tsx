import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { auth } from "@/modules/auth/lib/auth";
import { getSession } from "@/modules/auth/lib/session";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { OAuthConsentActions } from "./components/OAuthConsentActions";

type TSearchParams = Record<string, string | string[] | undefined>;

type TOAuthPublicClient = {
  client_id?: string;
  client_name?: string;
  client_uri?: string;
  contacts?: string[];
};

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

const getHostFromUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

const isLocalhostHost = (host: string | null): boolean =>
  Boolean(host && (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]")));

const getScopeLabel = (scope: string, t: Awaited<ReturnType<typeof getTranslate>>): string => {
  switch (scope) {
    case "openid":
      return t("auth.oauth.scopes.openid");
    case "profile":
      return t("auth.oauth.scopes.profile");
    case "email":
      return t("auth.oauth.scopes.email");
    case "offline_access":
      return t("auth.oauth.scopes.offline_access");
    case "surveys:read":
      return t("auth.oauth.scopes.surveys_read");
    case "surveys:write":
      return t("auth.oauth.scopes.surveys_write");
    default:
      return scope;
  }
};

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
  const requestedScopes = getRequestedScopes(scope);
  const client = clientId ? await getPublicOAuthClient(clientId) : null;

  if (!clientId || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Alert variant="error">
            <AlertTitle>{t("auth.oauth.invalid_oauth_request")}</AlertTitle>
            <AlertDescription>{t("auth.oauth.invalid_oauth_request_description")}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const clientName = client.client_name ?? t("auth.oauth.unknown_client");
  const clientUriHost = getHostFromUrl(client.client_uri ?? null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
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

          {requestedScopes.length > 0 && (
            <div>
              <dt className="font-medium text-slate-900">{t("auth.oauth.requested_permissions")}</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {requestedScopes.map((requestedScope) => (
                  <span
                    key={requestedScope}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                    {getScopeLabel(requestedScope, t)}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>

        {isLocalhostHost(redirectHost) && (
          <Alert variant="warning" size="small" className="mt-6">
            <AlertTitle>{t("auth.oauth.localhost_redirect_warning")}</AlertTitle>
            <AlertDescription>{t("auth.oauth.localhost_redirect_warning_description")}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6">
          <OAuthConsentActions />
        </div>
      </div>
    </div>
  );
};

export default Page;
