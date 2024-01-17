import { getUserSegmentActiveInactiveSurveys } from "@formbricks/lib/userSegment/service";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TUserSegment } from "@formbricks/types/userSegment";

import SegmentTableDataRow from "./SegmentTableDataRow";

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
