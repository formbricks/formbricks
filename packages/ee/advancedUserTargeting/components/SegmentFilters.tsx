import { MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import {
  addFilterBelow,
  addFilterInGroup,
  createGroupFromResource,
  deleteEmptyGroups,
  deleteResource,
  isResourceFilter,
  moveResource,
  toggleGroupConnector,
} from "@formbricks/lib/userSegment/utils";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import {
  TBaseFilter,
  TBaseFilters,
  TUserSegment,
  TUserSegmentConnector,
} from "@formbricks/types/userSegment";
import { Button } from "@formbricks/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";

import AddFilterModal from "./AddFilterModal";
import SegmentFilterItem from "./SegmentFilterItem";

type TSegmentFilterProps = {
  group: TBaseFilters;
  environmentId: string;
  userSegment: TUserSegment;
  userSegments: TUserSegment[];
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  setUserSegment: React.Dispatch<React.SetStateAction<TUserSegment>>;
};

const SegmentFilters = ({
  group,
  environmentId,
  setUserSegment,
  userSegment,
  actionClasses,
  attributeClasses,
  userSegments,
}: TSegmentFilterProps) => {
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [addFilterModalOpenedFromBelow, setAddFilterModalOpenedFromBelow] = useState(false);

  const handleAddFilterBelow = (resourceId: string, filter: TBaseFilter) => {
    const localSegmentCopy = structuredClone(userSegment);

    if (localSegmentCopy.filters) {
      addFilterBelow(localSegmentCopy.filters, resourceId, filter);
    }

    setUserSegment(localSegmentCopy);
  };

  const handleCreateGroup = (resourceId: string) => {
    const localSegmentCopy = structuredClone(userSegment);
    if (localSegmentCopy.filters) {
      createGroupFromResource(localSegmentCopy.filters, resourceId);
    }

    setUserSegment(localSegmentCopy);
  };

  const handleMoveResource = (resourceId: string, direction: "up" | "down") => {
    const localSegmentCopy = structuredClone(userSegment);
    if (localSegmentCopy.filters) {
      moveResource(localSegmentCopy.filters, resourceId, direction);
    }

    setUserSegment(localSegmentCopy);
  };

  const handleDeleteResource = (resourceId: string) => {
    const localSegmentCopy = structuredClone(userSegment);

    if (localSegmentCopy.filters) {
      deleteResource(localSegmentCopy.filters, resourceId);

      // check if there are any empty groups and delete them
      deleteEmptyGroups(localSegmentCopy.filters);
    }

    setUserSegment(localSegmentCopy);
  };

  const handleToggleGroupConnector = (groupId: string, newConnectorValue: TUserSegmentConnector) => {
    const localSegmentCopy = structuredClone(userSegment);
    if (localSegmentCopy.filters) {
      toggleGroupConnector(localSegmentCopy.filters, groupId, newConnectorValue);
    }

    setUserSegment(localSegmentCopy);
  };

  const onConnectorChange = (groupId: string, connector: TUserSegmentConnector) => {
    if (!connector) return;

    if (connector === "and") {
      handleToggleGroupConnector(groupId, "or");
    } else {
      handleToggleGroupConnector(groupId, "and");
    }
  };

  const handleAddFilterInGroup = (groupId: string, filter: TBaseFilter) => {
    const localSegmentCopy = structuredClone(userSegment);

    if (localSegmentCopy.filters) {
      addFilterInGroup(localSegmentCopy.filters, groupId, filter);
    }
    setUserSegment(localSegmentCopy);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-white">
      {group?.map((groupItem) => {
        const { connector, resource, id: groupId } = groupItem;

        if (isResourceFilter(resource)) {
          return (
            <SegmentFilterItem
              key={groupId}
              connector={connector}
              resource={resource}
              environmentId={environmentId}
              userSegment={userSegment}
              userSegments={userSegments}
              actionClasses={actionClasses}
              attributeClasses={attributeClasses}
              setUserSegment={setUserSegment}
              handleAddFilterBelow={handleAddFilterBelow}
              onCreateGroup={(filterId: string) => handleCreateGroup(filterId)}
              onDeleteFilter={(filterId: string) => handleDeleteResource(filterId)}
              onMoveFilter={(filterId: string, direction: "up" | "down") =>
                handleMoveResource(filterId, direction)
              }
            />
          );
        } else {
          return (
            <div key={groupId}>
              <div className="flex items-start gap-2">
                <div key={connector} className="w-auto">
                  <span
                    className={cn(!!connector && "cursor-pointer underline", "text-sm")}
                    onClick={() => onConnectorChange(groupId, connector)}>
                    {!!connector ? connector : "Where"}
                  </span>
                </div>

                <div className="rounded-lg border-2 border-slate-300 bg-white p-4">
                  <SegmentFilters
                    group={resource}
                    environmentId={environmentId}
                    userSegment={userSegment}
                    setUserSegment={setUserSegment}
                    actionClasses={actionClasses}
                    attributeClasses={attributeClasses}
                    userSegments={userSegments}
                  />

                  <div className="mt-4">
                    <Button variant="secondary" size="sm" onClick={() => setAddFilterModalOpen(true)}>
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
                    userSegments={userSegments}
                  />
                </div>

                <div className="flex items-center gap-2 p-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger>
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

                      <DropdownMenuItem onClick={() => handleCreateGroup(groupId)}>
                        Create group
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handleMoveResource(groupId, "up")}>
                        Move up
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => handleMoveResource(groupId, "down")}>
                        Move down
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button onClick={() => handleDeleteResource(groupId)}>
                    <Trash2 className="h-4 w-4 cursor-pointer" />
                  </button>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default SegmentFilters;
