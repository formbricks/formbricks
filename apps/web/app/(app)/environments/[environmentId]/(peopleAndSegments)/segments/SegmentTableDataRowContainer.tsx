import SegmentTableDataRow from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/segments/SegmentTableDataRow";
import { getUserSegmentActiveInactiveSurveys } from "@formbricks/lib/services/userSegment";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import React from "react";

type TSegmentTableDataRowProps = {
  currentSegment: TUserSegment;
};

const SegmentTableDataRowContainer = async ({ currentSegment }: TSegmentTableDataRowProps) => {
  const { activeSurveys = [], inactiveSurveys = [] } = await getUserSegmentActiveInactiveSurveys(
    currentSegment.id
  );

  return <SegmentTableDataRow currentSegment={{ ...currentSegment, activeSurveys, inactiveSurveys }} />;
};

export default SegmentTableDataRowContainer;
