import { getSegmentActiveInactiveSurveys } from "@formbricks/lib/segment/service";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSegment } from "@formbricks/types/segment";

import SegmentTableDataRow from "./SegmentTableDataRow";

type TSegmentTableDataRowProps = {
  currentSegment: TSegment;
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  actionClasses: TActionClass[];
  isAdvancedUserTargetingAllowed: boolean;
};

const SegmentTableDataRowContainer = async ({
  currentSegment,
  segments,
  actionClasses,
  attributeClasses,
  isAdvancedUserTargetingAllowed,
}: TSegmentTableDataRowProps) => {
  const { activeSurveys = [], inactiveSurveys = [] } = await getSegmentActiveInactiveSurveys(
    currentSegment.id
  );

  return (
    <SegmentTableDataRow
      currentSegment={{
        ...currentSegment,
        activeSurveys,
        inactiveSurveys,
      }}
      segments={segments}
      actionClasses={actionClasses}
      attributeClasses={attributeClasses}
      isAdvancedUserTargetingAllowed={isAdvancedUserTargetingAllowed}
    />
  );
};

export default SegmentTableDataRowContainer;
