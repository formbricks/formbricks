"use client";

import { Button } from "@/modules/ui/components/button";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { WalletModal } from "./WalletBalanceCard/components/wallet-modal";

export const WalletPageHeader = () => {
  const user = useUser();
  const address = user?.address || "";
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { t } = useTranslate();

  const handleMintToken = () => {
    window.open("https://app.engagehq.xyz/s/cm9sr6au60006t9010yzp17m7", "_blank");
  };

  return (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-2xl font-bold text-slate-900">My Wallet</h2>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="text-tertiary hover:bg-primary/10 rounded-lg border-2 border-[#51D6FF]"
          onClick={handleMintToken}>
          {t("common.mint_token")}
        </Button>
        <Button
          variant="outline"
          className="text-tertiary hover:bg-primary/10 rounded-lg border-2 border-[#51D6FF]"
          onClick={() => setShowWalletModal(true)}>
          {t("common.deposit")}
        </Button>
      </div>

      <WalletModal address={address} open={showWalletModal} setOpen={setShowWalletModal} />
    </div>
  );
};
