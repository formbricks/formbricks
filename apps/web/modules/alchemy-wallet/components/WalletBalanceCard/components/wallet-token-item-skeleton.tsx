import { TableCell, TableRow } from "@/modules/ui/components/table";

export default function WalletTokenItemSkeleton() {
  const skeletonPulseStyle = "animate-pulse rounded bg-slate-200";
  return (
    <TableRow>
      <TableCell>
        <div className={`h-5 w-24 ${skeletonPulseStyle}`}></div>
      </TableCell>
      <TableCell>
        <div className={`h-5 w-32 ${skeletonPulseStyle}`}></div>
      </TableCell>
      <TableCell align="right">
        <div className={`h-5 w-16 ${skeletonPulseStyle}`}></div>
      </TableCell>
      <TableCell align="right">
        <div className={`h-9 w-28 ${skeletonPulseStyle}`}></div>
      </TableCell>
    </TableRow>
  );
}
