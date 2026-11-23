"use client";

import { useAtomValue } from "jotai";
import { MoveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode } from "@formbricks/workflows";
import { useMoveStep } from "@/modules/ee/workflows/hooks/use-step-move";
import { getCanvasBranches } from "@/modules/ee/workflows/lib/definition-to-flow";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import type { TPasteTarget } from "@/modules/ee/workflows/lib/step-clipboard";
import { getMoveTargetKey, getMoveTargets } from "@/modules/ee/workflows/lib/step-move";
import { workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/modules/ui/components/dropdown-menu";

// "Move to…" in a step's ⋮ menu: the keyboard's way to do what dragging the card onto a `+` does,
// listing the same places in the order the tree reads.
export const MoveStepMenuItem = ({ nodeId }: Readonly<{ nodeId: string }>) => {
  const { t } = useTranslation();
  const definition = useAtomValue(workflowDefinitionAtom);
  const move = useMoveStep();
  if (!definition) return null;
  const targets = getMoveTargets(definition, nodeId);

  const stepOf = (id: string): TWorkflowNode | undefined =>
    definition.trigger?.id === id ? definition.trigger : definition.nodes.find((node) => node.id === id);
  const titleOf = (id: string) => {
    const node = stepOf(id);
    return node ? getNodeRegistryEntry(node).title(node, t) : id;
  };
  const labelOf = (target: TPasteTarget): string => describeTarget(definition, target, titleOf, stepOf, t);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-x-2" disabled={targets.length === 0}>
        <MoveIcon className="size-4" />
        {t("workspace.workflows.move_step_to")}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto motion-reduce:animate-none">
          {targets.map((target) => (
            <DropdownMenuItem
              key={getMoveTargetKey(target)}
              onClick={(event) => {
                event.stopPropagation();
                move(nodeId, target);
              }}>
              <span className="truncate">{labelOf(target)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
};

/** "Before “Send email”", "After “Send email”", or "Else branch of “If/else”" for an empty branch. */
const describeTarget = (
  definition: TWorkflowDefinition,
  target: TPasteTarget,
  titleOf: (id: string) => string,
  stepOf: (id: string) => TWorkflowNode | undefined,
  t: ReturnType<typeof useTranslation>["t"]
): string => {
  if ("edgeId" in target) {
    const edge = definition.edges.find((item) => item.id === target.edgeId);
    return t("workspace.workflows.move_target_before", { step: edge ? titleOf(edge.target) : "" });
  }
  if (target.branch === undefined) {
    return t("workspace.workflows.move_target_after", { step: titleOf(target.sourceNodeId) });
  }
  const source = stepOf(target.sourceNodeId);
  const branch = source
    ? getCanvasBranches(source, t).find(({ handle }) => handle === target.branch)?.label
    : undefined;
  return t("workspace.workflows.move_target_branch", {
    branch: branch ?? target.branch,
    step: titleOf(target.sourceNodeId),
  });
};
