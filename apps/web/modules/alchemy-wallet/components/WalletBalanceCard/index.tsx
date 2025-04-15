"use client";

import WalletAddress from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-address";
import WalletEthBalance from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-eth-balance";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { formatUnits } from "ethers";
import { SendIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useBlockscoutApi } from "@formbricks/web3";
import SendModal from "../common/send-modal";
import Address from "./components/address";

export function WalletBalanceCard({ className = "" }: { className?: string }) {
  const { t } = useTranslate();
  const user = useUser();
  const address = user?.address || "";
  const blockscoutApi = useBlockscoutApi();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [selectedBalance, setSelectedBalance] = useState<TokenBalance | null>(null);

  useEffect(() => {
    (async () => {
      if (!address || !blockscoutApi) return;
      const data = await blockscoutApi.getAddressTokenBalances(address);
      setBalances(data.data);
    })();
  }, [blockscoutApi, address]);

  if (!balances) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:flex-row",
          className
        )}
        id={"wallet-balance"}>
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {/* Wallet Address */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
                {t("environments.wallet.balance_card.wallet_address")}
              </h3>
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-md p-2">
              <WalletAddress />
            </div>
          </div>
          {/* Eth Balance */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
                {t("environments.wallet.balance_card.balance")}
              </h3>
            </div>
            <WalletEthBalance />
          </div>
        </div>
      </div>
      <div
        className={cn(
          "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:flex-row",
          className
        )}>
        <div className="col-span-3 flex flex-col gap-2">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
            {t("common.token_balances")}
          </h3>
          <Table className="w-full" style={{ tableLayout: "fixed" }} id="response-table">
            <TableHeader className="pointer-events-auto">
              <TableRow>
                <TableHead>{t("common.token")}</TableHead>
                <TableHead>{t("common.address")}</TableHead>
                <TableHead align="right">{t("common.quantity")}</TableHead>
                <TableHead align="right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {balances.map((balance) => (
                <TableRow>
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
                      onClick={() => setSelectedBalance(balance)}
                      className="inline-flex flex-nowrap items-center gap-2">
                      <SendIcon className="h-4 w-4" strokeWidth={2} />
                      {t("common.withdraw")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <SendModal balance={selectedBalance} onClose={() => setSelectedBalance(null)} />
        </div>
      </div>
    </>
  );
}

export default WalletBalanceCard;
