import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { auth } from "@/modules/auth/lib/auth";
import {
  type TOAuthPublicClient,
  getHostFromUrl,
  isLocalhostHost,
} from "@/modules/auth/lib/oauth-client-metadata";
import { getSession } from "@/modules/auth/lib/session";
import { ConsentForm } from "@/modules/shell/consent/components/consent-form";
import { parseRequestedScopes } from "@/modules/shell/consent/lib/consent-scopes";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Logo } from "@/modules/ui/components/logo";

type TSearchParams = Record<string, string | string[] | undefined>;

const getSearchParam = (searchParams: TSearchParams, key: string): string | null => {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

/** The page's own URL with its full query, so signing in lands back here with the authorization request. */
const getCallbackPath = (searchParams: TSearchParams): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/account/authorize?${query}` : "/account/authorize";
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

const ConsentLayout = ({
  logoLabel,
  children,
}: Readonly<{ logoLabel: string; children: React.ReactNode }>) => (
  <div className="flex min-h-dvh flex-col items-center gap-6 bg-slate-50 px-4 pt-10 pb-14">
    <Link
      target="_blank"
      href="https://formbricks.com?utm_source=formbricks-app&utm_medium=webapp&utm_campaign=oauth_consent_logo"
      rel="noopener noreferrer"
      aria-label={logoLabel}>
      <Logo aria-hidden="true" className="h-8 w-auto" />
    </Link>
    {children}
  </div>
);

/**
 * OAuth consent screen: where a person decides what an agent that wants to connect may do. This is the
 * `consentPage` Better Auth redirects to (modules/auth/lib/mcp-oauth-provider-options.ts), so the path
 * and the query it arrives with must not change. It is a standalone card, outside the shell chrome.
 */
const AuthorizePage = async ({ searchParams }: Readonly<{ searchParams: Promise<TSearchParams> }>) => {
  const resolvedSearchParams = await searchParams;
  const session = await getSession();
  if (!session?.user) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(getCallbackPath(resolvedSearchParams))}`);
  }

  const t = await getTranslate();
  const clientId = getSearchParam(resolvedSearchParams, "client_id");
  const redirectHost = getHostFromUrl(getSearchParam(resolvedSearchParams, "redirect_uri"));
  const requestedScopes = parseRequestedScopes(getSearchParam(resolvedSearchParams, "scope"));
  const client = clientId ? await getPublicOAuthClient(clientId) : null;
  const logoLabel = t("auth.oauth.formbricks_website");

  if (!clientId || !client) {
    return (
      <ConsentLayout logoLabel={logoLabel}>
        <main className="w-full max-w-140 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
          <Alert variant="error" role="status">
            <AlertTitle>{t("auth.oauth.invalid_oauth_request")}</AlertTitle>
            <AlertDescription>{t("auth.oauth.invalid_oauth_request_description")}</AlertDescription>
          </Alert>
        </main>
      </ConsentLayout>
    );
  }

  const clientName = client.client_name ?? t("auth.oauth.unknown_client");
  const displayedHost = redirectHost ?? getHostFromUrl(client.client_uri);

  return (
    <ConsentLayout logoLabel={logoLabel}>
      <main className="flex w-full max-w-140 flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">
            {t("shell.consent.title", { clientName })}
          </h1>
          <p className="text-slate-500">{t("shell.consent.signed_in_as", { email: session.user.email })}</p>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <dt className="text-slate-500">{t("shell.consent.app")}</dt>
          <dd className="mb-2 font-medium break-words text-slate-800 sm:mb-0">{clientName}</dd>
          {displayedHost && (
            <>
              <dt className="text-slate-500">{t("auth.oauth.redirect_host")}</dt>
              <dd className="mb-2 font-mono font-medium break-all text-slate-800 sm:mb-0">{displayedHost}</dd>
            </>
          )}
          {client.client_uri && (
            <>
              <dt className="text-slate-500">{t("auth.oauth.client_uri")}</dt>
              <dd className="font-medium break-all text-slate-800">{client.client_uri}</dd>
            </>
          )}
        </dl>

        {/* There is no verified-client concept: any MCP client can register itself (docs/platform/mcp). */}
        <Alert variant="info" role="status">
          <AlertTitle>{t("shell.consent.self_registered_title")}</AlertTitle>
          <AlertDescription>{t("shell.consent.self_registered_description")}</AlertDescription>
        </Alert>

        {isLocalhostHost(redirectHost) && (
          <Alert variant="warning" role="status">
            <AlertTitle>{t("auth.oauth.localhost_redirect_warning")}</AlertTitle>
            <AlertDescription>{t("auth.oauth.localhost_redirect_warning_description")}</AlertDescription>
          </Alert>
        )}

        <ConsentForm requestedScopes={requestedScopes} />
      </main>

      <p className="max-w-[56ch] text-center text-xs text-slate-500">{t("shell.consent.footer")}</p>
    </ConsentLayout>
  );
};

export default AuthorizePage;
