import SegmentTableDataRow from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentTableDataRow";
import { getUserSegmentActiveInactiveSurveys } from "@formbricks/lib/services/userSegment";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { TAttributeClass } from "@formbricks/types/v1/attributeClasses";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import React from "react";

type TSegmentTableDataRowProps = {
  currentSegment: TUserSegment;
  userSegments: TUserSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
};

const SegmentTableDataRowContainer = async ({
  currentSegment,
  userSegments,
  actionClasses,
  attributeClasses,
}: TSegmentTableDataRowProps) => {
  const { activeSurveys = [], inactiveSurveys = [] } = await getUserSegmentActiveInactiveSurveys(
    currentSegment.id
  );

  return (
    <SegmentTableDataRow
      currentSegment={{
        ...currentSegment,
        activeSurveys,
        inactiveSurveys,
      }}
      userSegments={userSegments}
      actionClasses={actionClasses}
      attributeClasses={attributeClasses}
    />
  );
};

export default SegmentTableDataRowContainer;
