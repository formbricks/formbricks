import { cn } from "@formbricks/lib/cn";
import { toggleFilterConnector } from "@formbricks/lib/segment/utils";
import { TSegment, TSegmentConnector } from "@formbricks/types/segment";

interface SegmentFilterItemConnectorProps {
  connector: TSegmentConnector;
  segment: TSegment;
  setSegment: (segment: TSegment) => void;
  filterId: string;
  viewOnly?: boolean;
}

export const SegmentFilterItemConnector = ({
  connector,
  segment,
  setSegment,
  filterId,
  viewOnly,
}: SegmentFilterItemConnectorProps) => {
  const updateLocalSurvey = (newConnector: TSegmentConnector) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      toggleFilterConnector(updatedSegment.filters, filterId, newConnector);
    }

    setSegment(updatedSegment);
  };

  const onConnectorChange = () => {
    if (!connector) return;

    if (connector === "and") {
      updateLocalSurvey("or");
    } else {
      updateLocalSurvey("and");
    }
  };

  return (
    <div className="w-[40px]">
      <span
        className={cn(!!connector && "cursor-pointer underline", viewOnly && "cursor-not-allowed")}
        onClick={() => {
          if (viewOnly) return;
          onConnectorChange();
        }}>
        {!!connector ? connector : "Where"}
      </span>
    </div>
  );
};
