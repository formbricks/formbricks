import { useTranslations } from "next-intl";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSegment } from "@formbricks/types/segment";
import { SegmentTableDataRowContainer } from "./SegmentTableDataRowContainer";

type TSegmentTableProps = {
  segments: TSegment[];
  attributeClasses: TAttributeClass[];
  isAdvancedTargetingAllowed: boolean;
  isReadOnly: boolean;
};

export const SegmentTable = ({
  segments,
  attributeClasses,
  isAdvancedTargetingAllowed,
  isReadOnly,
}: TSegmentTableProps) => {
  const t = useTranslations();
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-7 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-4 pl-6">{t("common.title")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.surveys")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.updated")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.created")}</div>
      </div>
      {segments.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          {t("environments.segments.create_your_first_segment")}
        </p>
      ) : (
        <>
          {segments.map((segment) => (
            <SegmentTableDataRowContainer
              currentSegment={segment}
              segments={segments}
              attributeClasses={attributeClasses}
              isAdvancedTargetingAllowed={isAdvancedTargetingAllowed}
              isReadOnly={isReadOnly}
            />
          ))}
        </>
      )}
    </div>
  );
};
