import { getSegmentActiveInactiveSurveys } from "@formbricks/lib/segment/service";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSegment } from "@formbricks/types/segment";

import BasicSegmentTableDataRow from "./BasicSegmentTableDataRow";

type TSegmentTableDataRowProps = {
  currentSegment: TSegment;
  attributeClasses: TAttributeClass[];
};

const BasicSegmentTableDataRowContainer = async ({
  currentSegment,
  attributeClasses,
}: TSegmentTableDataRowProps) => {
  const { activeSurveys = [], inactiveSurveys = [] } = await getSegmentActiveInactiveSurveys(
    currentSegment.id
  );

  return (
    <BasicSegmentTableDataRow
      currentSegment={{
        ...currentSegment,
        activeSurveys,
        inactiveSurveys,
      }}
      attributeClasses={attributeClasses}
    />
  );
};

export default BasicSegmentTableDataRowContainer;
