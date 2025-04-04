"use client";

import { useAuthModal, useLogout, useSignerStatus, useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import React from "react";

export function WalletButton(): React.JSX.Element {
  const user = useUser();
  const { openAuthModal } = useAuthModal();
  const signerStatus = useSignerStatus();
  const { logout } = useLogout();
  const { t } = useTranslate();

  return (
    <div className="flex w-full items-center justify-center gap-4 text-center">
      {signerStatus.isInitializing ? (
          <>{t("environments.wallet.button.loading")}</>
      ) : user ? (
        <div className="flex flex-col gap-2">
          <p className="text-xl font-bold">{t("environments.wallet.button.success")}</p>
          {t("environments.wallet.button.logged_in_as", { email: user.email ?? "anon" })}
          <button className="akui-btn akui-btn-primary mt-6" onClick={() => logout()}>
          {t("environments.wallet.button.logout")}
          </button>
        </div>
      ) : (
        <button className="akui-btn akui-btn-primary flex-1" onClick={openAuthModal}>
          {t("environments.wallet.button.login")}
        </button>
      )}
    </div>
  );
}

export default WalletButton;
