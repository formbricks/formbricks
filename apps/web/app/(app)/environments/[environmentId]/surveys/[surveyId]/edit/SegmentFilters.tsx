import { cn } from "@formbricks/lib/cn";
import {
  TBaseFilterGroup,
  TUserSegmentFilter,
  convertOperatorToText,
  convertMetricToText,
} from "@formbricks/types/v1/userSegment";
import { Select, SelectTrigger } from "@formbricks/ui";
// import { CursorArrowRaysIcon } from "@heroicons/react/24/solid";
import { MousePointerClick, TagIcon, Users2Icon, MonitorSmartphoneIcon } from "lucide-react";
import { useState } from "react";

const isResourceFilter = (
  resource: TUserSegmentFilter | TBaseFilterGroup
): resource is TUserSegmentFilter => {
  return (resource as TUserSegmentFilter).root !== undefined;
};

type TConnector = "and" | "or" | null;
type SegmentFilterItemProps = {
  connector: TConnector;
  resource: TUserSegmentFilter;
};

const SegmentFilterItem = ({ resource, connector }: SegmentFilterItemProps) => {
  const [connectorState, setConnectorState] = useState(connector);
  const [userSegmentOperator, setUserSegmentOperator] = useState(
    resource.root.type === "segment" ? resource.qualifier.operator : ""
  );

  const selectValue = () => {
    switch (resource.root.type) {
      case "action": {
        // fetch action class name from actionClassId
        return resource.root.actionClassId;
      }

      case "attribute": {
        // fetch attribute class name from attributeClassId
        return resource.root.attributeClassId;
      }

      case "segment": {
        // fetch segment name from userSegmentId
        return resource.root.userSegmentId;
      }

      case "device": {
        // fetch device type name from deviceType
        return resource.root.deviceType;
      }

      default: {
        return "";
      }
    }
  };

  const onConnectorChange = () => {
    if (!connectorState) return;

    if (connectorState === "and") {
      setConnectorState("or");
      return;
    }

    setConnectorState("and");
  };

  // action UI

  if (resource.root.type === "action") {
    const operatorText = convertOperatorToText(resource.qualifier.operator);
    let qualifierMetric: string = "";

    if ("metric" in resource.qualifier) {
      qualifierMetric = convertMetricToText(resource.qualifier.metric);
    }

    return (
      <div className="flex items-center gap-4 text-sm">
        <span className={cn(!!connectorState && "cursor-pointer underline")} onClick={onConnectorChange}>
          {!!connectorState ? connectorState : "Where"}
        </span>

        <Select value={resource.root.actionClassId}>
          <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <MousePointerClick className="h-4 w-4 text-sm" />
              <p>{resource.root.actionClassId}</p>
            </div>
          </SelectTrigger>
        </Select>

        {!!qualifierMetric && (
          <Select value={qualifierMetric}>
            <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
              <p>{qualifierMetric}</p>
            </SelectTrigger>
          </Select>
        )}

        <Select value={operatorText}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
            <p>{operatorText}</p>
          </SelectTrigger>
        </Select>

        <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <p>{resource.value}</p>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  // attribute UI

  if (resource.root.type === "attribute") {
    const operatorText = convertOperatorToText(resource.qualifier.operator);

    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="w-[40px]">
          <span className={cn(!!connectorState && "cursor-pointer underline")} onClick={onConnectorChange}>
            {!!connectorState ? connectorState : "Where"}
          </span>
        </div>

        <Select value={resource.root.attributeClassId}>
          <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <TagIcon className="h-4 w-4 text-sm" />
              <p>{resource.root.attributeClassId}</p>
            </div>
          </SelectTrigger>
        </Select>

        <Select value={operatorText}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
            <p>{operatorText}</p>
          </SelectTrigger>
        </Select>

        <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <p>{resource.value}</p>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  // segment UI

  if (resource.root.type === "segment") {
    const onSegmentChange = () => {
      if (!userSegmentOperator) return;

      if (userSegmentOperator === "userIsIn") {
        setUserSegmentOperator("userIsNotIn");
        return;
      }

      setUserSegmentOperator("userIsIn");
    };

    return (
      <div className="flex items-center gap-4">
        {/* Connector */}
        <span
          className={cn(!!connectorState && "cursor-pointer text-sm underline")}
          onClick={onConnectorChange}>
          {!!connectorState ? connectorState : "Where"}
        </span>

        {/* Segment */}
        <span className={cn("cursor-pointer text-sm underline")} onClick={onSegmentChange}>
          {convertOperatorToText(userSegmentOperator)}
        </span>

        <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <Users2Icon className="h-4 w-4" />
              <p>{resource.value}</p>
            </div>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  if (resource.root.type === "device") {
    const deviceType = resource.root.deviceType;
    const operatorText = convertOperatorToText(resource.qualifier.operator);

    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="w-[40px]">
          <span className={cn(!!connectorState && "cursor-pointer underline")} onClick={onConnectorChange}>
            {!!connectorState ? connectorState : "Where"}
          </span>
        </div>

        <Select value="device">
          <SelectTrigger className="flex w-auto items-center justify-center capitalize" hideArrow>
            <div className="flex items-center gap-1">
              <MonitorSmartphoneIcon className="h-4 w-4 text-sm" />
              <p>Device</p>
            </div>
          </SelectTrigger>
        </Select>

        <Select value={operatorText}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center" hideArrow>
            <p>{operatorText}</p>
          </SelectTrigger>
        </Select>

        <Select value={resource.value.toString()}>
          <SelectTrigger className="flex w-auto items-center justify-center text-center capitalize" hideArrow>
            <p>{resource.value}</p>
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {!!connector ? <p>{connector}</p> : <p>Where</p>}

      <Select value={selectValue()} onValueChange={(value) => console.log({ value })}>
        <SelectTrigger className="w-[120px] capitalize">
          <p>{selectValue()}</p>
        </SelectTrigger>

        {/* <SelectContent>
          {attributeClasses
            .filter((attributeClass) => !attributeClass.archived)
            .map((attributeClass) => (
              <SelectItem value={attributeClass.id}>{attributeClass.name}</SelectItem>
            ))}
        </SelectContent> */}
      </Select>

      <Select value={convertOperatorToText(resource.qualifier.operator)}>
        <SelectTrigger className="flex w-[40px] items-center justify-center text-center" hideArrow>
          <p>{convertOperatorToText(resource.qualifier.operator)}</p>
        </SelectTrigger>
      </Select>

      <div className="rounded-lg border-2 p-2">{resource.value}</div>
    </div>
  );
};

const SegmentFilters = ({ segment }: { segment: TBaseFilterGroup }) => {
  return (
    <div className="flex flex-col gap-4">
      {segment.map((group) => {
        const { connector, resource } = group;

        if (isResourceFilter(resource)) {
          return <SegmentFilterItem connector={connector} resource={resource} />;
        } else {
          return (
            <div className="flex items-start gap-2">
              <span className="cursor-pointer text-sm underline">{!!connector ? connector : "Where"}</span>
              <div className="flex-1 rounded-lg border-2 border-slate-300 p-4">
                <SegmentFilters segment={resource} />
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default SegmentFilters;
