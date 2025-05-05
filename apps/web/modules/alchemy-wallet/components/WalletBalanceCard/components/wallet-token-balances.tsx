"use client";

import Address from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/address";
import NoTokensCTACard from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/no-tokens-cta-card";
import { WalletModal } from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-modal";
import WalletTokenItemSkeleton from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-token-item-skeleton";
import SendModal from "@/modules/alchemy-wallet/components/common/send-modal";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { formatUnits } from "ethers";
import { PlusIcon, SendIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useBlockscoutApi } from "@formbricks/web3";

export function WalletTokenBalances({ className = "" }: { className?: string }) {
  const { t } = useTranslate();
  const user = useUser();
  const address = user?.address || "";
  const blockscoutApi = useBlockscoutApi();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<TokenBalance | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const openSendModal = useCallback(() => {
    setShowSendModal(true);
  }, []);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !blockscoutApi) return;
      const data = await blockscoutApi.getAddressTokenBalances(address);

      setBalances(data.data);
    };

    fetchBalances();

    let interval = setInterval(fetchBalances, 60000);
    return () => clearInterval(interval);
  }, [blockscoutApi, address]);

  if (!balances) {
    return (
      <div
        className={cn(
          "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:flex-row",
          className
        )}>
        <div className="col-span-3 flex w-full flex-col gap-2">
          <h3 className="text-lg font-medium text-slate-900">{t("common.token_balances")}</h3>
          <Table className="w-full" style={{ tableLayout: "fixed" }} id="response-table">
            <TableHeader className="pointer-events-auto">
              <TableRow>
                <TableHead>{t("common.token")}</TableHead>
                <TableHead>{t("common.address")}</TableHead>
                <TableHead align="right">{t("common.value")}</TableHead>
                <TableHead align="right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <WalletTokenItemSkeleton />
              <WalletTokenItemSkeleton />
              <WalletTokenItemSkeleton />
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (balances.length < 1) {
    return (
      <div
        className={cn(
          "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:flex-row",
          className
        )}>
        <div className="col-span-3 flex w-full flex-col gap-2">
          <div className="flex w-full items-center gap-2">
            <h3 className="text-lg font-medium text-slate-900">{t("common.token_balances")}</h3>
            <WalletModal address={address} open={showWalletModal} setOpen={setShowWalletModal} />
            <Button className="h-6 w-6 rounded-md p-0" onClick={() => setShowWalletModal(true)}>
              <PlusIcon className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
          <Table className="w-full" style={{ tableLayout: "fixed" }} id="response-table">
            <TableHeader className="pointer-events-auto">
              <TableRow>
                <TableHead>{t("common.token")}</TableHead>
                <TableHead>{t("common.address")}</TableHead>
                <TableHead align="right">{t("common.value")}</TableHead>
                <TableHead align="right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="flex flex-col items-center justify-center py-2 text-center">
                    <p className="mt-2 text-sm text-slate-500">
                      {t("environments.wallet.balance_card.you_dont_have_any_tokens_in_your_wallet_yet")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <NoTokensCTACard />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:flex-row",
        className
      )}>
      <div className="col-span-3 flex flex-col gap-2">
        <div className="flex w-full items-center gap-2">
          <h3 className="text-lg font-medium text-slate-900">{t("common.token_balances")}</h3>
          <WalletModal address={address} open={showWalletModal} setOpen={setShowWalletModal} />
          <Button className="h-6 w-6 rounded-md p-0" onClick={() => setShowWalletModal(true)}>
            <PlusIcon className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
        <Table className="w-full" style={{ tableLayout: "fixed" }} id="response-table">
          <TableHeader className="pointer-events-auto">
            <TableRow>
              <TableHead>{t("common.token")}</TableHead>
              <TableHead>{t("common.address")}</TableHead>
              <TableHead align="right">{t("common.value")}</TableHead>
              <TableHead align="right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {balances.map((balance) => (
              <TableRow key={balance.token.address}>
                <TableCell>{balance.token.name}</TableCell>
                <TableCell>
                  <Address address={balance.token.address} />{" "}
                </TableCell>
                <TableCell align="right">
                  {formatUnits(balance.value, parseInt(balance.token.decimals, 10))}
                </TableCell>
                <TableCell align="right">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedBalance(balance);
                      openSendModal();
                    }}
                    className="inline-flex flex-nowrap items-center gap-2">
                    <SendIcon className="h-4 w-4" strokeWidth={2} />
                    {t("common.withdraw")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <SendModal
          onSelectBalance={setSelectedBalance}
          balances={balances}
          balance={selectedBalance}
          open={showSendModal}
          setOpen={setShowSendModal}
        />
      </div>
    </div>
  );
}

export default WalletTokenBalances;
