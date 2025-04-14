import { TokenTransfer, TotalERC20, TotalERC1155 } from "@wonderchain/sdk/dist/blockscout-client";
import { SendIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { formatDateWithOrdinal } from "@formbricks/lib/utils/datetime";
import { formatAddress } from "@formbricks/web3";

export type Transaction = TokenTransfer & { total: TotalERC20 | TotalERC1155 };

interface TransactionItemProps {
  transaction: Transaction;
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const token = transaction.token;
  // export interface TokenTransfer {
  //     'block_hash': string;
  //     'from': AddressParam;
  //     'log_index': number;
  //     'method'?: string;
  //     'timestamp'?: string;
  //     'to': AddressParam;
  //     'token': TokenInfo;
  //     'total': TokenTransferTotal;
  //     'transaction_hash': string;
  //     'type': string;
  // }
  // export type TokenTransferTotal = TotalERC1155 | TotalERC20 | TotalERC721;
  // export interface TotalERC1155 { // Want to display value and token instance
  //     'token_id': string;
  //     'decimals': string;
  //     'value': string;
  //     'token_instance'?: NFTInstance;
  // }
  // export interface TotalERC20 { // Want to display value
  //     'decimals': string;
  //     'value': string;
  // }
  // export interface TotalERC721 { // Want to display nft
  //     'token_id': string;
  //     'token_instance'?: NFTInstance;
  // }
  return (
    <>
      <div className={cn("flex flex-row items-center gap-3 px-2 py-1")}>
        <div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-full text-green-600">
          <SendIcon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-1 flex-row justify-between gap-4">
            <p className="text-sm font-semibold">Recieved from {formatAddress(transaction.to.hash)}</p>
            <span className="text-sm font-normal text-green-600">{`${transaction.total.value} ${token.symbol}`}</span>
          </div>
          <div className="flex flex-1 flex-row justify-between gap-4">
            <span className="text-xs"></span>
            <span className="text-xs">
              {transaction.timestamp ? formatDateWithOrdinal(new Date(transaction.timestamp)) : "N/A"}
            </span>
          </div>
        </div>
      </div>
      {/* {JSON.stringify(transaction)} */}
    </>
  );
}

export default TransactionItem;
