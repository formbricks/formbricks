"use client";

import { useAuthModal } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import React from "react";



export function LoginButton(): React.JSX.Element {
  const { openAuthModal } = useAuthModal();
  const { t } = useTranslate();

  return (
    <button type="button" className="akui-btn akui-btn-primary flex-1" onClick={openAuthModal}>
        {t("environment.wallet.button.login")}
    </button>
    );
}

export default LoginButton;