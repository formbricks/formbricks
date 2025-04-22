import { getSurveysBySegmentId } from "@/lib/survey/service";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { SegmentTableDataRow } from "./segment-table-data-row";

type TSegmentTableDataRowProps = {
  currentSegment: TSegment;
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
};

export const SegmentTableDataRowContainer = async ({
  currentSegment,
  segments,
  contactAttributeKeys,
  isContactsEnabled,
  isReadOnly,
}: TSegmentTableDataRowProps) => {
  const surveys = await getSurveysBySegmentId(currentSegment.id);

  const activeSurveys = surveys?.length
    ? surveys.filter((survey) => survey.status === "inProgress").map((survey) => survey.name)
    : [];

  const inactiveSurveys = surveys?.length
    ? surveys.filter((survey) => ["draft", "paused"].includes(survey.status)).map((survey) => survey.name)
    : [];

  const filteredSegments = segments.filter((segment) => segment.id !== currentSegment.id);

  return (
    <SegmentTableDataRow
      currentSegment={{
        ...currentSegment,
        activeSurveys,
        inactiveSurveys,
      }}
      segments={filteredSegments}
      contactAttributeKeys={contactAttributeKeys}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
    />
  );
};
