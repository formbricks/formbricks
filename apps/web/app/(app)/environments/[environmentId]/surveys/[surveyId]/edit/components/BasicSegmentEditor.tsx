import { deleteResource, isResourceFilter, moveResource } from "@formbricks/lib/userSegment/utils";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilters, TUserSegment } from "@formbricks/types/userSegment";

import BasicSegmentFilter from "./BasicSegmentFilter";

type TSegmentFilterProps = {
  group: TBaseFilters;
  environmentId: string;
  userSegment: TUserSegment;
  attributeClasses: TAttributeClass[];
  setUserSegment: React.Dispatch<React.SetStateAction<TUserSegment>>;
};

const BasicSegmentEditor = ({
  group,
  environmentId,
  setUserSegment,
  userSegment,
  attributeClasses,
}: TSegmentFilterProps) => {
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
    }

    setUserSegment(localSegmentCopy);
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg">
      {group?.map((groupItem) => {
        const { connector, resource, id: groupId } = groupItem;

        if (isResourceFilter(resource)) {
          return (
            <BasicSegmentFilter
              key={groupId}
              connector={connector}
              resource={resource}
              environmentId={environmentId}
              userSegment={userSegment}
              attributeClasses={attributeClasses}
              setUserSegment={setUserSegment}
              onDeleteFilter={(filterId: string) => handleDeleteResource(filterId)}
              onMoveFilter={(filterId: string, direction: "up" | "down") =>
                handleMoveResource(filterId, direction)
              }
            />
          );
        } else {
          return null;
        }
      })}
    </div>
  );
};

export default BasicSegmentEditor;
