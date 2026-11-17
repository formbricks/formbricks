"use client";

import { useAtomValue } from "jotai";
import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInsertWorkflowStepOnEdge } from "@/modules/ee/workflows/hooks/use-append-workflow-step";
import { useStepClipboard } from "@/modules/ee/workflows/hooks/use-step-clipboard";
import { isBranchingStep } from "@/modules/ee/workflows/lib/workflow-steps";
import { workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import {
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { WorkflowStepPickerItems } from "./workflow-add-step-menu";

// "Insert a step after" in a step's ⋮ menu: the keyboard's way to put a step between this step and
// the next. The line's own `+` shows on hover, but ReactFlow draws lines after every card and control,
// so it comes last when tabbing; the menu sits right after its card. Only for a step with a step after
// it: at the end of a path, its own `+` comes next anyway; an If/else or Switch has one per branch.
export const InsertStepAfterMenuItem = ({
  nodeId,
  nodeType,
}: Readonly<{ nodeId: string; nodeType: string }>) => {
  const { t } = useTranslation();
  const definition = useAtomValue(workflowDefinitionAtom);
  const insertStep = useInsertWorkflowStepOnEdge();
  const { paste, canPasteAt } = useStepClipboard();
  const node = definition?.nodes.find((item) => item.id === nodeId);
  const next = definition?.edges.find((edge) => edge.source === nodeId);
  if (!next || isBranchingStep(node)) return null;
  const target = { edgeId: next.id };

  return (
    <DropdownMenuSub>
      {/* Same icon spacing as the menu's other items (DropdownMenuItem's gap-x-2). */}
      <DropdownMenuSubTrigger className="gap-x-2">
        <PlusIcon className="size-4" />
        {t("workspace.workflows.insert_step_after")}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="w-64 motion-reduce:animate-none">
          <WorkflowStepPickerItems
            afterNodeType={nodeType}
            onAdd={(stepType) => insertStep(next.id, nodeId, stepType)}
            onPaste={canPasteAt(target) ? () => paste(target) : undefined}
          />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};
