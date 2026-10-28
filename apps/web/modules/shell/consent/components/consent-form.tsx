"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { authClient } from "@/modules/auth/lib/auth-client";
import { getOAuthScopeLabel } from "@/modules/auth/lib/oauth-client-metadata";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Label } from "@/modules/ui/components/label";
import { resolveConsentRedirectUrl } from "../lib/consent-redirect";
import {
  type TConsentGroupId,
  buildConsentGroups,
  buildGrantedScope,
  canAllowAccess,
  getDefaultSelection,
  hasWriteScope,
  isOfflineAccessRequested,
  toggleScope,
} from "../lib/consent-scopes";

interface ConsentFormProps {
  /** Every scope the client asked for, as parsed from the `scope` query parameter. */
  requestedScopes: string[];
}

// Spelled out rather than looked up by group id: `scan-translations` does not follow built keys.
const getGroupTitle = (id: TConsentGroupId, t: (key: string) => string): string => {
  switch (id) {
    case "surveys_workflows":
      return t("shell.consent.groups.surveys_workflows");
    case "feedback":
      return t("shell.consent.groups.feedback");
    case "respondent_data":
      return t("shell.consent.groups.respondent_data");
    case "integrations_audit":
      return t("shell.consent.groups.integrations_audit");
  }
};

export const ConsentForm = ({ requestedScopes }: Readonly<ConsentFormProps>) => {
  const { t } = useTranslation();
  const groups = buildConsentGroups(requestedScopes);
  const offlineRequested = isOfflineAccessRequested(requestedScopes);

  const [selected, setSelected] = useState<string[]>(() => getDefaultSelection(requestedScopes));
  const [keepAccess, setKeepAccess] = useState(true);
  const [pendingAction, setPendingAction] = useState<"accept" | "deny" | null>(null);

  const handleConsent = async (accept: boolean) => {
    setPendingAction(accept ? "accept" : "deny");

    try {
      // The oauthProviderClient plugin adds the signed `oauth_query` from window.location.search, which
      // is why this page has to keep the query it was opened with.
      const response = await authClient.oauth2.consent(
        accept
          ? { accept, scope: buildGrantedScope({ requested: requestedScopes, selected, keepAccess }) }
          : { accept }
      );
      if (response.error) {
        toast.error(t("auth.oauth.consent_failed"));
        return;
      }

      // Better Auth returns { redirect: true, url } for accept and deny alike.
      const redirectUrl = resolveConsentRedirectUrl(response.data);
      if (!redirectUrl) {
        toast.error(t("auth.oauth.consent_failed"));
        return;
      }

      window.location.href = redirectUrl;
    } catch {
      toast.error(t("auth.oauth.consent_failed"));
    } finally {
      setPendingAction(null);
    }
  };

  const isAllowed = canAllowAccess({ requested: requestedScopes, selected });

  return (
    <>
      {groups.length > 0 && (
        <section aria-labelledby="consent-permissions-title" className="flex flex-col gap-3">
          <h2 id="consent-permissions-title" className="text-base font-semibold text-slate-800">
            {t("shell.consent.choose_title")}
          </h2>

          {groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-label={getGroupTitle(group.id, t)}
              className="flex flex-col">
              <div className="flex items-center gap-2 py-1 font-medium text-slate-800">
                {getGroupTitle(group.id, t)}
                {group.personalData && (
                  <Badge text={t("shell.consent.personal_data")} type="warning" size="tiny" />
                )}
              </div>
              {group.scopes.map((scope) => (
                <div key={scope} className="flex items-start gap-2.5 border-t border-slate-100 py-2">
                  <Checkbox
                    id={`consent-${scope}`}
                    className="mt-px"
                    checked={selected.includes(scope)}
                    disabled={pendingAction !== null}
                    onCheckedChange={(checked) =>
                      setSelected((current) =>
                        toggleScope({
                          selected: current,
                          scope,
                          checked: checked === true,
                          requested: requestedScopes,
                        })
                      )
                    }
                  />
                  <Label
                    htmlFor={`consent-${scope}`}
                    className="cursor-pointer leading-5 font-normal text-slate-700">
                    {getOAuthScopeLabel(scope, t)}
                  </Label>
                </div>
              ))}
            </div>
          ))}

          {offlineRequested && (
            <div className="flex items-start gap-2.5 border-t border-slate-200 pt-3">
              <Checkbox
                id="consent-offline-access"
                className="mt-px"
                checked={keepAccess}
                disabled={pendingAction !== null}
                onCheckedChange={(checked) => setKeepAccess(checked === true)}
              />
              <Label
                htmlFor="consent-offline-access"
                className="cursor-pointer leading-5 font-normal text-slate-700">
                {t("shell.consent.keep_access")}
              </Label>
            </div>
          )}

          {hasWriteScope(selected) && (
            <p className="text-sm text-slate-500">{t("shell.consent.write_expiry")}</p>
          )}
          {!isAllowed && <p className="text-sm text-slate-500">{t("shell.consent.choose_one")}</p>}
        </section>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleConsent(false)}
          loading={pendingAction === "deny"}
          disabled={pendingAction !== null}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => handleConsent(true)}
          loading={pendingAction === "accept"}
          disabled={pendingAction !== null || !isAllowed}>
          {t("auth.oauth.allow_access")}
        </Button>
      </div>
    </>
  );
};
