import { TokenTransfer } from "@wonderchain/sdk/dist/blockscout-client";
import { SendIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";

interface TransactionItemProps {
  transfer: TokenTransfer;
}

export function TransactionItem({ transfer }: TransactionItemProps) {
  return (
    <>
      <div className={cn("flex flex-row items-center gap-3 px-2 py-1")}>
        <div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-full text-green-600">
          <SendIcon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-1 flex-row justify-between gap-4">
            <p className="text-sm font-semibold">Recieved from 0x3a8d...e92f</p>
            <span className="text-sm font-normal text-green-600">+25 USDC</span>
          </div>
          <div className="flex flex-1 flex-row justify-between gap-4">
            <span className="text-xs">Survey Reward</span>
            <span className="text-xs">Mar 25, 2025 at 05:15 AM</span>
          </div>
        </div>
      </div>
      {JSON.stringify(transfer)}
    </>
  );
}

export default TransactionItem;
