import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { cn } from "@formbricks/lib/cn";
import {
  TBaseFilterGroup,
  TUserSegmentFilter,
  convertOperatorToText,
  convertMetricToText,
} from "@formbricks/types/v1/userSegment";
import { Dialog, DialogContent, DialogTrigger, Input, Select, SelectTrigger, TabBar } from "@formbricks/ui";
import { MousePointerClick, TagIcon, Users2Icon, MonitorSmartphoneIcon, PlusCircleIcon } from "lucide-react";
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
  const {} = useAttributeClasses(environmentId);

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
};

const SegmentFilters = ({ segment }: { segment: TBaseFilterGroup }) => {
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [activeTabId, setActiveId] = useState<string>("all");

  const tabs: {
    id: string;
    label: string;
    icon?: React.ReactNode;
  }[] = [
    { id: "all", label: "All" },
    { id: "actions", label: "Actions", icon: <MousePointerClick className="h-4 w-4" /> },
    { id: "attributes", label: "Attributes", icon: <TagIcon className="h-4 w-4" /> },
    { id: "segments", label: "Segments", icon: <Users2Icon className="h-4 w-4" /> },
    { id: "devices", label: "Devices", icon: <MonitorSmartphoneIcon className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-lg">
      {segment.map((group) => {
        const { connector, resource } = group;

        if (isResourceFilter(resource)) {
          return <SegmentFilterItem connector={connector} resource={resource} />;
        } else {
          return (
            <div className="flex items-start gap-2">
              <span className="cursor-pointer text-sm underline">{!!connector ? connector : "Where"}</span>
              <div className="rounded-lg border-2 border-slate-300 p-4">
                <SegmentFilters segment={resource} />
              </div>
            </div>
          );
        }
      })}

      <Dialog>
        <DialogTrigger className="max-w-[160px]">
          <button className="flex items-center gap-2 text-sm">
            <PlusCircleIcon className="h-4 w-4" />
            <p>Add filter</p>
          </button>
        </DialogTrigger>

        <DialogContent className="w-[600px] bg-slate-100 sm:max-w-2xl" hideCloseButton>
          <div className="flex w-auto flex-col">
            <Input placeholder="Browse filters..." autoFocus />

            <TabBar
              className="bg-slate-100"
              tabs={tabs}
              activeId={activeTabId}
              setActiveId={setActiveId}></TabBar>
          </div>

          <div>{activeTabId}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SegmentFilters;
