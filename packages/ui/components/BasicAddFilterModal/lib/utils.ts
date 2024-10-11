import { createId } from "@paralleldrive/cuid2";
import { TBaseFilter, TSegmentAttributeFilter, TSegmentPersonFilter } from "@formbricks/types/segment";

export const handleAddFilter = ({
  type,
  attributeClassName,
  isUserId = false,
  onAddFilter,
  setOpen,
}: {
  type: "person" | "attribute";
  attributeClassName?: string;
  isUserId?: boolean;
  onAddFilter: (filter: TBaseFilter) => void;
  setOpen: (open: boolean) => void;
}) => {
  if (type === "person") {
    const newResource: TSegmentPersonFilter = {
      id: createId(),
      root: { type: "person", personIdentifier: "userId" },
      qualifier: {
        operator: "equals",
      },
      value: "",
    };

    const newFilter: TBaseFilter = {
      id: createId(),
      connector: "and",
      resource: newResource,
    };

    onAddFilter(newFilter);
    setOpen(false);

    return;
  }

  if (!attributeClassName) return;

  const newFilterResource: TSegmentAttributeFilter = {
    id: createId(),
    root: {
      type: "attribute",
      attributeClassName,
    },
    qualifier: {
      operator: "equals",
    },
    value: "",
    ...(isUserId && { meta: { isUserId } }),
  };

  const newFilter: TBaseFilter = {
    id: createId(),
    connector: "and",
    resource: newFilterResource,
  };

  onAddFilter(newFilter);
  setOpen(false);
};
