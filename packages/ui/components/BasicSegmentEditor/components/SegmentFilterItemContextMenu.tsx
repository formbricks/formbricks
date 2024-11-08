import { ArrowDownIcon, ArrowUpIcon, EllipsisVerticalIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@formbricks/lib/cn";
import { Button } from "../../Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../DropdownMenu";

interface SegmentFilterItemContextMenuProps {
  filterId: string;
  onDeleteFilter: (filterId: string) => void;
  onMoveFilter: (filterId: string, direction: "up" | "down") => void;
  viewOnly?: boolean;
}

export const SegmentFilterItemContextMenu = ({
  filterId,
  onDeleteFilter,
  onMoveFilter,
  viewOnly,
}: SegmentFilterItemContextMenuProps) => {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger disabled={viewOnly}>
          <EllipsisVerticalIcon className="h-4 w-4 text-slate-700 hover:text-slate-950" />
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => onMoveFilter(filterId, "up")}
            icon={<ArrowUpIcon className="h-4 w-4" />}>
            {t("common.move_up")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onMoveFilter(filterId, "down")}
            icon={<ArrowDownIcon className="h-4 w-4" />}>
            {t("common.move_down")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="minimal"
        className="mr-4 p-0"
        onClick={() => {
          onDeleteFilter(filterId);
        }}
        disabled={viewOnly}>
        <Trash2Icon className={cn("h-4 w-4 cursor-pointer", viewOnly && "cursor-not-allowed")} />
      </Button>
    </div>
  );
};
