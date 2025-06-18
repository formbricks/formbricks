"use client";

import Address from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/address";
import NoTokensCTACard from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/no-tokens-cta-card";
import WalletTokenItemSkeleton from "@/modules/alchemy-wallet/components/WalletBalanceCard/components/wallet-token-item-skeleton";
import SendModal from "@/modules/alchemy-wallet/components/common/send-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslate } from "@tolgee/react";
import { TokenBalance } from "@wonderchain/sdk/dist/blockscout-client";
import { formatUnits } from "ethers";
import { SendIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { isMobile } from "react-device-detect";
import { cn } from "@formbricks/lib/cn";
import { formatAddress } from "@formbricks/web3";

interface WalletTokenBalancesProps {
  className?: string;
  balances?: TokenBalance[] | null;
  setBalances?: (balances: TokenBalance[] | null) => void;
}

export function WalletTokenBalances({ balances, className }: WalletTokenBalancesProps) {
  const { t } = useTranslate();

  const params = useParams();
  const environmentId = params.environmentId as string;

  const [selectedBalance, setSelectedBalance] = useState<TokenBalance | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const openSendModal = useCallback(() => {
    setShowSendModal(true);
  }, []);

  const MobileTokenBalanceCard = ({ balance }: { balance: TokenBalance }) => (
    <div className="mb-3 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="max-w-[100px] truncate font-medium">{balance.token.name}</div>
        </div>
        <button
          onClick={() => {
            setSelectedBalance(balance);
            openSendModal();
          }}
          className="flex flex-nowrap items-center gap-1 px-2 py-1 text-xs">
          <SendIcon className="h-3 w-3" strokeWidth={2} />
          {t("common.withdraw")}
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-1 text-sm">
        <div className="flex justify-between gap-1">
          <span className="text-slate-500">{t("common.address")}:</span>
          <Address address={formatAddress(balance.token.address, 3)} variant="small" />
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{t("common.value")}:</span>
          <span>{formatUnits(balance.value, parseInt(balance.token.decimals, 10))}</span>
        </div>
      </div>
    </div>
  );

  if (!balances) {
    return (
      <div className="flex justify-center">
        <div
          className={cn(
            "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:w-2/3 md:flex-row",
            className
          )}>
          <div className="col-span-3 flex w-full flex-col gap-2">
            <h3 className="text-lg font-medium text-slate-900">{t("common.token_holdings")}</h3>
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
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <TokenCardContainer
        title={t("common.token_holdings")}
        className={"min-h-[200px] items-center md:flex-row"}>
        <div className="col-span-3 flex w-full flex-col items-center gap-1">
          <div>
            <p className="text-center text-sm">{t("environments.wallet.token_holding.no_tokens_yet")}</p>
          </div>
          <Link
            href={{ pathname: `/environments/${environmentId}/engagements` }}
            className={cn(
              "text-tertiary hover:text-tertiary/50 inline-flex justify-center whitespace-nowrap p-4 text-base font-bold disabled:pointer-events-none disabled:opacity-50",
              className
            )}>
            {t("common.discover_engagements")}
          </Link>
        </div>
        {!isMobile && <NoTokensCTACard />}
      </TokenCardContainer>
    );
  }

  return (
    <div className="flex justify-center p-4 md:p-0">
      <div
        className={cn(
          "relative my-4 flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm md:w-2/3 md:flex-row",
          className
        )}>
        <div className="col-span-3 flex flex-col gap-2">
          <div className="flex w-full items-center gap-2">
            <h3 className="text-lg font-medium text-slate-900">{t("common.token_holdings")}</h3>
          </div>

          <div className="md:hidden">
            {balances.map((balance) => (
              <MobileTokenBalanceCard key={balance.token.address} balance={balance} />
            ))}
          </div>
          <Table className="hidden md:table md:w-full" style={{ tableLayout: "fixed" }} id="response-table">
            <TableHeader className="pointer-events-auto">
              <TableRow>
                <TableHead>{t("common.token")}</TableHead>
                <TableHead>{t("common.address")}</TableHead>
                <TableHead align="right">{t("common.value")}</TableHead>
                <TableHead align="right"></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {balances.map((balance) => (
                <TableRow key={balance.token.address}>
                  <TableCell>{balance.token.name}</TableCell>
                  <TableCell>
                    <Address address={balance.token.address} variant="small" />{" "}
                  </TableCell>
                  <TableCell align="right">
                    {formatUnits(balance.value, parseInt(balance.token.decimals, 10))}
                  </TableCell>
                  <TableCell align="right">
                    <button
                      onClick={() => {
                        setSelectedBalance(balance);
                        openSendModal();
                      }}
                      className="text-tertiary inline-flex flex-nowrap items-center gap-2 font-bold">
                      {t("common.withdraw")}
                    </button>
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
    </div>
  );
}

export default WalletTokenBalances;

interface TokenCardContainerProps {
  title: string;
  className?: string;
  children: React.ReactNode;
}

export function TokenCardContainer({ title, className = "", children }: TokenCardContainerProps) {
  return (
    <div className="flex w-full justify-center">
      <div className="w-full p-4 md:w-2/3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <div
          className={cn(
            "shadow-card-20 relative my-5 flex w-full flex-col justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4",
            className
          )}
          id="token-holdings">
          {children}
        </div>
      </div>
    </div>
  );
}
