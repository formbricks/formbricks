import { MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import {
  addFilterBelow,
  addFilterInGroup,
  createGroupFromResource,
  deleteResource,
  isResourceFilter,
  moveResource,
  toggleGroupConnector,
} from "@formbricks/lib/segment/utils";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilter, TBaseFilters, TSegment, TSegmentConnector } from "@formbricks/types/segment";
import { Button } from "@formbricks/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";

import AddFilterModal from "./AddFilterModal";
import SegmentFilter from "./SegmentFilter";

type TSegmentEditorProps = {
  group: TBaseFilters;
  environmentId: string;
  segment: TSegment;
  segments: TSegment[];
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  setSegment: React.Dispatch<React.SetStateAction<TSegment>>;
  viewOnly?: boolean;
};

const SegmentEditor = ({
  group,
  environmentId,
  setSegment,
  segment,
  actionClasses,
  attributeClasses,
  segments,
  viewOnly = false,
}: TSegmentEditorProps) => {
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [addFilterModalOpenedFromBelow, setAddFilterModalOpenedFromBelow] = useState(false);

  const handleAddFilterBelow = (resourceId: string, filter: TBaseFilter) => {
    const localSegmentCopy = structuredClone(segment);

    if (localSegmentCopy.filters) {
      addFilterBelow(localSegmentCopy.filters, resourceId, filter);
    }

    setSegment(localSegmentCopy);
  };

  const handleCreateGroup = (resourceId: string) => {
    const localSegmentCopy = structuredClone(segment);
    if (localSegmentCopy.filters) {
      createGroupFromResource(localSegmentCopy.filters, resourceId);
    }

    setSegment(localSegmentCopy);
  };

  const handleMoveResource = (resourceId: string, direction: "up" | "down") => {
    const localSegmentCopy = structuredClone(segment);
    if (localSegmentCopy.filters) {
      moveResource(localSegmentCopy.filters, resourceId, direction);
    }

    setSegment(localSegmentCopy);
  };

  const handleDeleteResource = (resourceId: string) => {
    const localSegmentCopy = structuredClone(segment);

    if (localSegmentCopy.filters) {
      deleteResource(localSegmentCopy.filters, resourceId);
    }

    setSegment(localSegmentCopy);
  };

  const handleToggleGroupConnector = (groupId: string, newConnectorValue: TSegmentConnector) => {
    const localSegmentCopy = structuredClone(segment);
    if (localSegmentCopy.filters) {
      toggleGroupConnector(localSegmentCopy.filters, groupId, newConnectorValue);
    }

    setSegment(localSegmentCopy);
  };

  const onConnectorChange = (groupId: string, connector: TSegmentConnector) => {
    if (!connector) return;

    if (connector === "and") {
      handleToggleGroupConnector(groupId, "or");
    } else {
      handleToggleGroupConnector(groupId, "and");
    }
  };

  const handleAddFilterInGroup = (groupId: string, filter: TBaseFilter) => {
    const localSegmentCopy = structuredClone(segment);

    if (localSegmentCopy.filters) {
      addFilterInGroup(localSegmentCopy.filters, groupId, filter);
    }
    setSegment(localSegmentCopy);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg">
      {group?.map((groupItem) => {
        const { connector, resource, id: groupId } = groupItem;

        if (isResourceFilter(resource)) {
          return (
            <SegmentFilter
              key={groupId}
              connector={connector}
              resource={resource}
              environmentId={environmentId}
              segment={segment}
              segments={segments}
              actionClasses={actionClasses}
              attributeClasses={attributeClasses}
              setSegment={setSegment}
              handleAddFilterBelow={handleAddFilterBelow}
              onCreateGroup={(filterId: string) => handleCreateGroup(filterId)}
              onDeleteFilter={(filterId: string) => handleDeleteResource(filterId)}
              onMoveFilter={(filterId: string, direction: "up" | "down") =>
                handleMoveResource(filterId, direction)
              }
              viewOnly={viewOnly}
            />
          );
        } else {
          return (
            <div key={groupId}>
              <div className="flex items-start gap-2">
                <div key={connector} className="w-auto">
                  <span
                    className={cn(
                      !!connector && "cursor-pointer underline",
                      "text-sm",
                      viewOnly && "cursor-not-allowed"
                    )}
                    onClick={() => {
                      if (viewOnly) return;
                      onConnectorChange(groupId, connector);
                    }}>
                    {!!connector ? connector : "Where"}
                  </span>
                </div>

                <div className="rounded-lg border-2 border-slate-300 bg-white p-4">
                  <SegmentEditor
                    group={resource}
                    environmentId={environmentId}
                    segment={segment}
                    setSegment={setSegment}
                    actionClasses={actionClasses}
                    attributeClasses={attributeClasses}
                    segments={segments}
                    viewOnly={viewOnly}
                  />

                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (viewOnly) return;
                        setAddFilterModalOpen(true);
                      }}
                      disabled={viewOnly}>
                      Add filter
                    </Button>
                  </div>

                  <AddFilterModal
                    open={addFilterModalOpen}
                    setOpen={setAddFilterModalOpen}
                    onAddFilter={(filter) => {
                      if (addFilterModalOpenedFromBelow) {
                        handleAddFilterBelow(groupId, filter);
                        setAddFilterModalOpenedFromBelow(false);
                      } else {
                        handleAddFilterInGroup(groupId, filter);
                      }
                    }}
                    actionClasses={actionClasses}
                    attributeClasses={attributeClasses}
                    segments={segments}
                  />
                </div>

                <div className="flex items-center gap-2 p-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger disabled={viewOnly}>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => {
                          setAddFilterModalOpenedFromBelow(true);
                          setAddFilterModalOpen(true);
                        }}>
                        Add filter below
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          handleCreateGroup(groupId);
                        }}>
                        Create group
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          handleMoveResource(groupId, "up");
                        }}>
                        Move up
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          if (viewOnly) return;
                          handleMoveResource(groupId, "down");
                        }}>
                        Move down
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="minimal"
                    className="p-0"
                    disabled={viewOnly}
                    onClick={() => {
                      if (viewOnly) return;
                      handleDeleteResource(groupId);
                    }}>
                    <Trash2 className={cn("h-4 w-4 cursor-pointer", viewOnly && "cursor-not-allowed")} />
                  </Button>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default SegmentEditor;
