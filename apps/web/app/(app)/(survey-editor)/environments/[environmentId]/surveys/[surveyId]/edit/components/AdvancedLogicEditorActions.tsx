import { CopyIcon, CornerDownRightIcon, MoreVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { removeAction } from "@formbricks/lib/survey/logic/utils";
import { TSurveyAdvancedLogic } from "@formbricks/types/surveys/logic";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Select, SelectContent, SelectTrigger } from "@formbricks/ui/Select";

interface AdvancedLogicEditorActions {
  logicItem: TSurveyAdvancedLogic;
  handleActionsChange: (action: "delete" | "addBelow" | "duplicate", actionIdx: number) => void;
}

export function AdvancedLogicEditorActions({ logicItem, handleActionsChange }: AdvancedLogicEditorActions) {
  const actions = logicItem.actions;

  return (
    <div className="">
      <div className="flex gap-2">
        <CornerDownRightIcon className="mt-2 h-5 w-5" />
        <div className="flex w-full flex-col gap-y-2">
          {actions.map((action, idx) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span>{idx === 0 ? "Then" : "and"}</span>
              <Select>
                <SelectTrigger></SelectTrigger>
                <SelectContent></SelectContent>
              </Select>
              <Select>
                <SelectTrigger></SelectTrigger>
                <SelectContent></SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <MoreVerticalIcon className="h-4 w-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => {
                      handleActionsChange("addBelow", idx);
                    }}>
                    <PlusIcon className="h-4 w-4" />
                    Add action below
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    disabled={actions.length === 1}
                    onClick={() => {
                      handleActionsChange("delete", idx);
                    }}>
                    <Trash2Icon className="h-4 w-4" />
                    Remove
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => {
                      handleActionsChange("duplicate", idx);
                    }}>
                    <CopyIcon className="h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
