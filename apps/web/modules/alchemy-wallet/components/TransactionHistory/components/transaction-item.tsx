import { cn } from "@formbricks/lib/cn"
import { ArrowDownLeftIcon } from "lucide-react";
// , ArrowUpRightIcon, ZapIcon, RefreshCwIcon 
interface TransactionItemProps {

}

export function TransactionItem({}:TransactionItemProps) {

    return (
        <div
        className={cn(
            "flex flex-row items-center gap-3 px-2 py-1",
        )}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-green-600">
                <ArrowDownLeftIcon className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
                <div className="flex flex-row gap-4 flex-1 justify-between">
                    <p className="text-sm font-semibold">Recieved from 0x3a8d...e92f</p>
                    <span className="text-sm font-normal text-green-600">+25 USDC</span>
                </div>
                <div className="flex flex-row gap-4 flex-1 justify-between">
                    <span className="text-xs">Survey Reward</span>
                    <span className="text-xs">Mar 25, 2025 at 05:15 AM</span>
                </div>
            </div>
        </div>
    )
}

export default TransactionItem