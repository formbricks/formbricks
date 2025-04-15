"use client";

import WalletAddress from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-address";
import WalletEthBalance from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-eth-balance";
import IconButton from "@/modules/alchemy-wallet/components/common/icon-button";
import SendModal from "@/modules/alchemy-wallet/components/common/send-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useUser } from "@account-kit/react";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { formatUnits } from "ethers";
import { EyeIcon, EyeOffIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { useBlockscoutApi } from "@formbricks/web3";
import Address from "./components/address";

export function WalletBalanceCard({ className = "" }: { className?: string }) {
  const { t } = useTranslate();
  const [showBalance, setShowBalance] = useState(true);
  const user = useUser();
  const address = user?.address || "";
  const blockscoutApi = useBlockscoutApi();
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);

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
              <IconButton
                className="text-black hover:text-black"
                icon={SquareArrowOutUpRightIcon}
                label={t("environments.wallet.balance_card.external_link")}
                onClick={() => (window.location.href = `https://etherscan.io/address/${address}`)}
              />
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
              <IconButton
                className="text-black hover:text-black"
                icon={!showBalance ? EyeIcon : EyeOffIcon}
                onClick={() => setShowBalance((prev) => !prev)}
                label={t("environments.wallet.balance_card.external_link")}
              />
            </div>
            <WalletEthBalance showBalance={showBalance} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <SendModal />
        </div>
      </div>
      <div
        className={cn(
          "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:flex-row",
          className
        )}>
        <div className="col-span-3 flex flex-col gap-2">
          <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">All Token Balances</h3>
          <Table className="w-full" style={{ tableLayout: "fixed" }} id="response-table">
            <TableHeader className="pointer-events-auto">
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Address</TableHead>
                <TableHead align="right">Quanity</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

export default WalletBalanceCard;
