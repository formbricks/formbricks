import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getSurveysBySegmentId } from "@formbricks/lib/survey/service";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { SegmentTableDataRow } from "./SegmentTableDataRow";

type TSegmentTableDataRowProps = {
  currentSegment: TSegment;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isAdvancedTargetingAllowed: boolean;
};

export const SegmentTableDataRowContainer = async ({
  currentSegment,
  segments,
  contactAttributeKeys,
  isAdvancedTargetingAllowed,
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
      contactAttributeKeys={contactAttributeKeys}
      isAdvancedTargetingAllowed={isAdvancedTargetingAllowed}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
    />
  );
};
