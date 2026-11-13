"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type TInviteRefusalState,
  getInviteRefusalState,
} from "@/modules/auth/invite/lib/acceptance-refusal";
import { acceptInvite } from "@/modules/auth/invite/lib/api-client";
import { Button } from "@/modules/ui/components/button";
import { ContentLayout } from "./content-layout";

type TAcceptState = "pending" | "accepted" | TInviteRefusalState;

/**
 * The invite page for the signed-in user an invite was sent to: nothing is joined until they press "Accept
 * invitation", which asks the server to check the invite again and create the membership.
 */
export const AcceptInvitation = ({ token }: Readonly<{ token: string }>) => {
  const { t } = useTranslation();
  const [state, setState] = useState<TAcceptState>("pending");
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    setHasFailed(false);
    try {
      await acceptInvite(token);
      setState("accepted");
    } catch (error) {
      const refusedState = getInviteRefusalState(error);
      if (refusedState) setState(refusedState);
      else setHasFailed(true);
    } finally {
      setIsAccepting(false);
    }
  };

  const goToApp = (
    <Button asChild>
      <Link href="/">{t("auth.invite.go_to_app")}</Link>
    </Button>
  );

  switch (state) {
    case "accepted":
      return (
        <ContentLayout
          headline={t("auth.invite.welcome_to_organization")}
          description={t("auth.invite.welcome_to_organization_description")}>
          {goToApp}
        </ContentLayout>
      );
    case "alreadyMember":
      return (
        <ContentLayout
          headline={t("auth.invite.already_a_member")}
          description={t("auth.invite.already_a_member_description")}>
          {goToApp}
        </ContentLayout>
      );
    case "expired":
      return (
        <ContentLayout
          headline={t("auth.invite.invite_expired")}
          description={t("auth.invite.invite_expired_description")}
        />
      );
    case "notFound":
      return (
        <ContentLayout
          headline={t("auth.invite.invite_not_found")}
          description={t("auth.invite.invite_not_found_description")}
        />
      );
    case "pending":
      return (
        <ContentLayout
          headline={t("auth.invite.you_are_invited")}
          description={t("auth.invite.you_are_invited_description")}>
          <Button onClick={handleAccept} loading={isAccepting}>
            {t("auth.invite.accept_invitation")}
          </Button>
          {hasFailed && (
            <p role="alert" className="w-full text-sm text-error">
              {t("common.something_went_wrong_please_try_again")}
            </p>
          )}
        </ContentLayout>
      );
  }
};
