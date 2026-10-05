"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { DATA_TYPE_ICONS, type TDataTypeName, getDataTypeLabel } from "./lib/data-types";

interface DataTypeBadgeProps {
  dataType: TDataTypeName;
  /**
   * `false` drops the glyph, for a place that already draws one — the survey editor's field row leads
   * with the same icon beside the name, so repeating it in the meta line says nothing twice.
   */
  showIcon?: boolean;
  /**
   * `false` drops the pill and leaves the icon alone, for a column narrow enough that the word costs
   * more than it carries. The name still reaches a screen reader through the icon's `aria-label`.
   */
  showLabel?: boolean;
  className?: string;
}

/**
 * What kind of value a field holds: the icon, the word, or both.
 *
 * Lifted out of the contact-attributes table (ENG-1860) so Embedded Data reads the same way. The two
 * had drifted into separate glyph sets for the same four kinds, which is the drift this component
 * exists to stop rather than a detail of how it renders.
 */
export const DataTypeBadge = ({
  dataType,
  showIcon = true,
  showLabel = true,
  className,
}: Readonly<DataTypeBadgeProps>) => {
  const { t } = useTranslation();
  const Icon = DATA_TYPE_ICONS[dataType];
  const label = getDataTypeLabel(dataType, t);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && (
        // Labelled only when it stands alone: beside the pill it would be read out twice.
        <Icon
          className="size-4 shrink-0 text-slate-500"
          aria-label={showLabel ? undefined : label}
          aria-hidden={showLabel ? true : undefined}
        />
      )}
      {showLabel && <Badge type="gray" size="normal" text={label} />}
    </div>
  );
};

export { DATA_TYPE_ICONS, getDataTypeLabel };
export type { TDataTypeName };
