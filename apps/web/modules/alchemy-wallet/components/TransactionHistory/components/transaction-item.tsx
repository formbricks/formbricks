import {
  TokenTransfer,
  TokenTransferTotal,
  TotalERC20,
  TotalERC1155,
} from "@wonderchain/sdk/dist/blockscout-client";
import { formatUnits } from "ethers";
import { SendIcon } from "lucide-react";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { formatDateWithOrdinal } from "@formbricks/lib/utils/datetime";
import { formatAddress } from "@formbricks/web3";

type TransactionRenderInfo = {
  icon: React.ReactNode;
  actionText: string;
  amountText: string;
  tag: string;
  color: string;
};

interface TransactionItemProps {
  transfer: TokenTransfer;
  isFromSelf: boolean;
  isToSelf: boolean;
}

export function TransactionItem({ isFromSelf, isToSelf, transfer }: TransactionItemProps) {
  function isERC20TotalOrERC1155Total(total: TokenTransferTotal): total is TotalERC20 | TotalERC1155 {
    return "value" in total;
  }
  // Update strings to useTranslate
  const mapTransferDataToTransaction = (type: string) => {
    let transactionUIData: TransactionRenderInfo = {
      icon: <SendIcon className="h-4 w-4" strokeWidth={2} />,
      actionText: `Received from ${formatAddress(transfer.from.hash)}`,
      amountText: "",
      tag: "Survey Reward",
      color: "text-green-600",
    };

    switch (type) {
      case "token_minting":
        transactionUIData = {
          icon: <ArrowDownLeftIcon className="h-4 w-4" strokeWidth={2} />,
          actionText: `Token Minted`,
          amountText: isERC20TotalOrERC1155Total(transfer.total)
            ? `+ ${formatUnits(transfer.total.value, parseInt(transfer.total.decimals, 10))} ${transfer.token.symbol}`
            : "",
          tag: "Survey Reward",
          color: "text-green-600",
        };
        break;
      case "token_transfer":
        if (isFromSelf && isToSelf) {
          transactionUIData = {
            icon: <ArrowUpRightIcon className="h-4 w-4" strokeWidth={2} />,
            actionText: `Sent/Recieved ${formatAddress(transfer.to.hash)}`,
            amountText: isERC20TotalOrERC1155Total(transfer.total)
              ? `${formatUnits(transfer.total.value, parseInt(transfer.total.decimals, 10))} ${transfer.token.symbol}`
              : "",
            tag: "Token Transfer to self",
            color: "text-slate-600",
          };
        } else if (isFromSelf) {
          transactionUIData = {
            icon: <ArrowUpRightIcon className="h-4 w-4" strokeWidth={2} />,
            actionText: `Sent to ${formatAddress(transfer.to.hash)}`,
            amountText: isERC20TotalOrERC1155Total(transfer.total)
              ? `- ${formatUnits(transfer.total.value, parseInt(transfer.total.decimals, 10))} ${transfer.token.symbol}`
              : "",
            tag: "Token Transfer",
            color: "text-red-600",
          };
        } else {
          transactionUIData = {
            icon: <ArrowDownLeftIcon className="h-4 w-4" strokeWidth={2} />,
            actionText: `Recieved from ${formatAddress(transfer.from.hash)}`,
            amountText: isERC20TotalOrERC1155Total(transfer.total)
              ? `+ ${formatUnits(transfer.total.value, parseInt(transfer.total.decimals, 10))} ${transfer.token.symbol}`
              : "",
            tag: "Token Transfer",
            color: "text-green-600",
          };
        }
        break;
      default:
        break;
    }

    return transactionUIData;
  };

  const transactionUIData = mapTransferDataToTransaction(transfer.type);

  return (
    <>
      <div className={cn("flex flex-row items-center gap-3 px-2 py-1")}>
        <div
          className={`bg-secondary flex h-8 w-8 items-center justify-center rounded-full ${transactionUIData.color}`}>
          {transactionUIData.icon}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-1 flex-row justify-between gap-4">
            <p className="text-sm font-semibold">{transactionUIData.actionText}</p>
            <span className={`text-sm font-normal ${transactionUIData.color}`}>
              {transactionUIData.amountText}
            </span>
          </div>
          <div className="flex flex-1 flex-row justify-between gap-4">
            <span className="text-xs">{transactionUIData.tag}</span>
            <span className="text-xs">
              {transfer.timestamp ? formatDateWithOrdinal(new Date(transfer.timestamp)) : "N/A"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default TransactionItem;
