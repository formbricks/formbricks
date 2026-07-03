import { headers } from "next/headers";
import { AuthenticationError } from "@formbricks/types/errors";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getUser } from "@/lib/user/service";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getTranslate } from "@/lingodotdev/server";
import { auth } from "@/modules/auth/lib/auth";
import {
  type TOAuthPublicClient,
  getHostFromUrl,
  getOAuthScopeLabel,
} from "@/modules/auth/lib/oauth-client-metadata";
import { getSession } from "@/modules/auth/lib/session";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { RevokeOAuthConsentButton } from "./components/RevokeOAuthConsentButton";

type TOAuthConsent = {
  id: string;
  clientId: string;
  scopes: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
};

type TAuthorizedApp = {
  consent: TOAuthConsent;
  client: TOAuthPublicClient | null;
};

const getAuthorizedApps = async (): Promise<TAuthorizedApp[]> => {
  const requestHeaders = await headers();
  const consents = (await auth.api.getOAuthConsents({ headers: requestHeaders })) as TOAuthConsent[];

  return await Promise.all(
    consents.map(async (consent) => {
      try {
        const client = (await auth.api.getOAuthClientPublic({
          query: { client_id: consent.clientId },
          headers: requestHeaders,
        })) as TOAuthPublicClient;

        return { consent, client };
      } catch {
        return { consent, client: null };
      }
    })
  );
};

const Page = async () => {
  const t = await getTranslate();
  const session = await getSession();
  if (!session?.user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const apps = await getAuthorizedApps();
  const locale = user.locale;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.authorized_apps")} />
      <SettingsCard
        title={t("auth.oauth.authorized_apps_title")}
        description={t("auth.oauth.authorized_apps_description")}>
        {apps.length === 0 ? (
          <p className="text-sm text-slate-600">{t("auth.oauth.no_authorized_apps")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("auth.oauth.client")}</TableHead>
                <TableHead>{t("auth.oauth.permissions")}</TableHead>
                <TableHead>{t("common.created_at")}</TableHead>
                <TableHead>{t("common.updated_at")}</TableHead>
                <TableHead className="text-right">{t("common.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map(({ consent, client }) => {
                const clientName = client?.client_name ?? consent.clientId;
                const clientHost = getHostFromUrl(client?.client_uri);

                return (
                  <TableRow key={consent.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{clientName}</p>
                        <p className="text-xs break-all text-slate-500">
                          {clientHost ?? client?.client_uri ?? consent.clientId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {consent.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                            {getOAuthScopeLabel(scope, t)}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatDateTimeForDisplay(new Date(consent.createdAt), locale)}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatDateTimeForDisplay(new Date(consent.updatedAt), locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RevokeOAuthConsentButton consentId={consent.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
