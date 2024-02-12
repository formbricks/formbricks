import { getSurveysBySegmentId } from "@formbricks/lib/survey/service";
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
  const surveys = await getSurveysBySegmentId(currentSegment.id);

  const activeSurveys = surveys?.length
    ? surveys.filter((survey) => survey.status === "inProgress").map((survey) => survey.name)
    : [];

  const inactiveSurveys = surveys?.length
    ? surveys.filter((survey) => ["draft", "paused"].includes(survey.status)).map((survey) => survey.name)
    : [];

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
