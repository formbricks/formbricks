import AddFilterModal from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/AddFilterModal";
import SegmentFilterItem from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/SegmentFilterItem";
import { createId } from "@paralleldrive/cuid2";
import { produce } from "immer";
import { MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import {
  TBaseFilterGroup,
  TBaseFilterGroupItem,
  TUserSegment,
  TUserSegmentConnector,
  isResourceFilter,
} from "@formbricks/types/userSegment";
import { Button } from "@formbricks/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";

type TSegmentFilterProps = {
  group: TBaseFilterGroup;
  environmentId: string;
  userSegment: TUserSegment;
  userSegments: TUserSegment[];
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  setUserSegment: (userSegment: TUserSegment) => void;
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

  const handleAddFilterBelow = (resourceId: string, filter: TBaseFilterGroupItem) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === resourceId) {
              group.splice(i + 1, 0, filter);
              break;
            }
          } else {
            if (group[i].id === resourceId) {
              group.splice(i + 1, 0, filter);
              break;
            } else {
              searchAndUpdate(resource);
            }
          }
        }
      };

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const handleCreateGroup = (resourceId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const searchAndCreateGroup = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const filterGroup = group[i];
          if (isResourceFilter(filterGroup.resource)) {
            if (filterGroup.resource.id === resourceId) {
              const newGroupToAdd: TBaseFilterGroupItem = {
                id: createId(),
                connector: filterGroup.connector,
                resource: [
                  {
                    ...filterGroup,
                    connector: null,
                  },
                ],
              };

              group.splice(i, 1, newGroupToAdd);

              break;
            }
          } else {
            if (group[i].id === resourceId) {
              // make an outer group, wrap the current group in it and add a filter below it

              const newFilter: TBaseFilterGroupItem = {
                id: createId(),
                connector: "and",
                resource: {
                  id: createId(),
                  root: { type: "attribute", attributeClassId: "" },
                  qualifier: { operator: "endsWith" },
                  value: "",
                },
              };

              const outerGroup: TBaseFilterGroupItem = {
                connector: filterGroup.connector,
                id: createId(),
                resource: [{ ...filterGroup, connector: null }, newFilter],
              };

              group.splice(i, 1, outerGroup);

              break;
            } else {
              searchAndCreateGroup(filterGroup.resource);
            }
          }
        }
      };

      if (draft.filters) {
        searchAndCreateGroup(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const handleMoveResource = (resourceId: string, direction: "up" | "down") => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const moveUp = (group: TBaseFilterGroup, i: number) => {
        if (i === 0) {
          return;
        }

        const previousTemp = group[i - 1];

        group[i - 1] = group[i];
        group[i] = previousTemp;

        if (i - 1 === 0) {
          const newConnector = group[i - 1].connector;

          group[i - 1].connector = null;
          group[i].connector = newConnector;
        }
      };

      const moveDown = (group: TBaseFilterGroup, i: number) => {
        if (i === group.length - 1) {
          return;
        }

        const temp = group[i + 1];
        group[i + 1] = group[i];
        group[i] = temp;

        // after the swap, determine if the connector should be null or not
        if (i === 0) {
          const nextConnector = group[i].connector;

          group[i].connector = null;
          group[i + 1].connector = nextConnector;
        }
      };

      const searchAndMove = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            if (resource.id === resourceId) {
              if (direction === "up") {
                moveUp(group, i);
                break;
              } else {
                moveDown(group, i);
                break;
              }
            }
          } else {
            if (group[i].id === resourceId) {
              if (direction === "up") {
                moveUp(group, i);
                break;
              } else {
                moveDown(group, i);
                break;
              }
            }

            searchAndMove(resource);
          }
        }
      };

      if (draft.filters) {
        searchAndMove(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const handleDeleteResource = (resourceId: string) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const deleteResource = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource) && resource.id === resourceId) {
            group.splice(i, 1);

            if (group.length) {
              group[0].connector = null;
            }

            break;
          } else if (!isResourceFilter(resource) && group[i].id === resourceId) {
            group.splice(i, 1);

            if (group.length) {
              group[0].connector = null;
            }

            break;
          } else if (!isResourceFilter(resource)) {
            deleteResource(resource);
          }
        }
      };

      const deleteEmptyGroups = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (!isResourceFilter(resource) && resource.length === 0) {
            group.splice(i, 1);
          } else if (!isResourceFilter(resource)) {
            deleteEmptyGroups(resource);
          }
        }
      };

      if (draft.filters) {
        deleteResource(draft.filters);

        // check if there are any empty groups and delete them
        deleteEmptyGroups(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const toggleGroupConnector = (groupId: string, newConnectorValue: TUserSegmentConnector) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const searchAndUpdate = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];
          if (!isResourceFilter(resource)) {
            if (group[i].id === groupId) {
              group[i].connector = newConnectorValue;
              break;
            } else {
              searchAndUpdate(resource);
            }
          }
        }
      };

      if (draft.filters) {
        searchAndUpdate(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
  };

  const onConnectorChange = (groupId: string, connector: TUserSegmentConnector) => {
    if (!connector) return;

    if (connector === "and") {
      toggleGroupConnector(groupId, "or");
    } else {
      toggleGroupConnector(groupId, "and");
    }
  };

  const handleAddFilterInGroup = (groupId: string, filter: TBaseFilterGroupItem) => {
    const updatedUserSegment = produce(userSegment, (draft) => {
      const addFilter = (group: TBaseFilterGroup) => {
        for (let i = 0; i < group.length; i++) {
          const { resource } = group[i];

          if (isResourceFilter(resource)) {
            continue;
          } else {
            if (group[i].id === groupId) {
              const { resource } = group[i];

              if (!isResourceFilter(resource)) {
                if (resource.length === 0) {
                  resource.push({
                    ...filter,
                    connector: null,
                  });
                } else {
                  resource.push(filter);
                }
              }

              break;
            } else {
              addFilter(resource);
            }
          }
        }
      };

      if (draft.filters) {
        addFilter(draft.filters);
      }
    });

    setUserSegment(updatedUserSegment);
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
