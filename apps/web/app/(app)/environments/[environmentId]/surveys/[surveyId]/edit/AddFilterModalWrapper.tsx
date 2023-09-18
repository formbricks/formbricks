import { getActionClasses } from "@formbricks/lib/services/actionClass";
import { getAttributeClasses } from "@formbricks/lib/services/attributeClass";
import { getUserSegments } from "@formbricks/lib/services/userSegment";
import React from "react";

type TAddFilterModalWrapperProps = {
  environmentId: string;
};

const AddFilterModalWrapper = async ({ environmentId }: TAddFilterModalWrapperProps) => {
  const [attributeClasses, actionClasses, userSegments] = await Promise.all([
    getAttributeClasses(environmentId),
    getActionClasses(environmentId),
    getUserSegments(environmentId),
  ]);

  return <div>AddFilterModalWrapper</div>;
};

export default AddFilterModalWrapper;
