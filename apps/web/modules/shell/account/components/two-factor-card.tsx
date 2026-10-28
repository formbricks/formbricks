"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authLinkClassName } from "@/modules/auth/components/auth-link";
import { DisableTwoFactorModal } from "@/modules/ee/two-factor-auth/components/disable-two-factor-modal";
import { EnableTwoFactorModal } from "@/modules/ee/two-factor-auth/components/enable-two-factor-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface TwoFactorCardProps {
  twoFactorEnabled: boolean;
  /** Whether the licence lets this person switch it on. Someone who already has it can always turn it off. */
  available: boolean;
  /** Where to go when it is not available: the billing page on Cloud, the licence request form elsewhere. */
  upgrade: { href: string; label: string; external: boolean };
}

export const TwoFactorCard = ({ twoFactorEnabled, available, upgrade }: Readonly<TwoFactorCardProps>) => {
  const { t } = useTranslation();
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("workspace.settings.profile.two_factor_authentication")}
        </CardTitle>
        <CardDescription>{t("shell.account.two_factor.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Switch
            id="account-two-factor"
            checked={twoFactorEnabled}
            disabled={!available}
            onCheckedChange={(checked) => {
              if (checked) {
                setEnableOpen(true);
              } else {
                setDisableOpen(true);
              }
            }}
          />
          <Label htmlFor="account-two-factor" className="cursor-pointer">
            {twoFactorEnabled ? t("common.enabled") : t("common.disabled")}
          </Label>
        </div>
        {!available && (
          <p className="text-slate-600">
            {t("shell.account.two_factor.not_available")}{" "}
            <Link
              className={authLinkClassName}
              href={upgrade.href}
              {...(upgrade.external ? { target: "_blank", rel: "noreferrer" } : {})}>
              {upgrade.label}
            </Link>
          </p>
        )}
      </CardContent>
      <EnableTwoFactorModal open={enableOpen} setOpen={setEnableOpen} />
      <DisableTwoFactorModal open={disableOpen} setOpen={setDisableOpen} />
    </Card>
  );
};
