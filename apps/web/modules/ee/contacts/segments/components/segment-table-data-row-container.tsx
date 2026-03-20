import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { getSurveysBySegmentId } from "@/lib/survey/service";
import { buildSegmentActivitySummary, getReferencingSegments } from "./segment-activity-utils";
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
  const directSurveys = await getSurveysBySegmentId(currentSegment.id);

  const activeSurveys = directSurveys?.length
    ? directSurveys.filter((survey) => survey.status === "inProgress").map((survey) => survey.name)
    : [];

  const inactiveSurveys = directSurveys?.length
    ? directSurveys
        .filter((survey) => ["draft", "paused"].includes(survey.status))
        .map((survey) => survey.name)
    : [];

  const filteredSegments = segments.filter((segment) => segment.id !== currentSegment.id);
  const referencingSegments = getReferencingSegments(filteredSegments, currentSegment.id);
  const indirectSurveyGroups = await Promise.all(
    referencingSegments.map(async (segment) => ({
      segmentId: segment.id,
      segmentTitle: segment.title,
      surveys: await getSurveysBySegmentId(segment.id),
    }))
  );
  const activitySummary = buildSegmentActivitySummary(directSurveys, indirectSurveyGroups);

  return (
    <SegmentTableDataRow
      currentSegment={{
        ...currentSegment,
        activeSurveys,
        inactiveSurveys,
      }}
      activitySummary={activitySummary}
      segments={filteredSegments}
      contactAttributeKeys={contactAttributeKeys}
      isContactsEnabled={isContactsEnabled}
      isReadOnly={isReadOnly}
    />
  );
};
