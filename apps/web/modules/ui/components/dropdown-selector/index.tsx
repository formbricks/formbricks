import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Label } from "@/modules/ui/components/label";

interface DropdownSelectorProps {
  label?: string;
  items: Array<any>;
  selectedItem: any;
  setSelectedItem: React.Dispatch<React.SetStateAction<any>>;
  disabled: boolean;
  placeholder?: string;
  refetch?: () => void;
  /** A reason an item cannot be picked, shown beside it; the item is disabled whenever this returns one. */
  getItemDisabledHint?: (item: any) => ReactNode;
}

export const DropdownSelector = ({
  label,
  items,
  selectedItem,
  setSelectedItem,
  disabled,
  placeholder,
  getItemDisabledHint,
}: Readonly<DropdownSelectorProps>) => {
  return (
    <div className="col-span-1">
      {label && <Label htmlFor={label}>{label}</Label>}
      <div className="mt-1 flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={disabled ? disabled : false}
              type="button"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300">
              <span className="flex w-4/5 flex-1">
                <span className="w-full truncate text-left">
                  {selectedItem ? selectedItem.name || placeholder || label : `${placeholder || label}`}
                </span>
              </span>
              <span className="flex h-full items-center border-l pl-3">
                <ChevronDownIcon className="size-4 text-slate-500" />
              </span>
            </button>
          </DropdownMenuTrigger>

          {!disabled && (
            <DropdownMenuPortal>
              <DropdownMenuContent
                className="z-50 max-h-64 max-w-96 min-w-[220px] overflow-auto rounded-md bg-white text-sm text-slate-800 shadow-md"
                align="start">
                {items
                  .sort((a, b) => a.name?.localeCompare(b.name))
                  .map((item) => {
                    const disabledHint = getItemDisabledHint?.(item);
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        disabled={!!disabledHint}
                        className="flex cursor-pointer items-center p-3 hover:bg-slate-100 hover:outline-hidden data-disabled:cursor-default data-disabled:opacity-50"
                        onSelect={() => setSelectedItem(item)}>
                        {item.name}
                        {disabledHint}
                      </DropdownMenuItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenuPortal>
          )}
        </DropdownMenu>
      </div>
    </div>
  );
};
