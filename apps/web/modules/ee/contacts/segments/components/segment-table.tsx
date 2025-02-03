import { getTranslate } from "@/tolgee/server";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { SegmentTableDataRowContainer } from "./segment-table-data-row-container";

type TSegmentTableProps = {
  segments: TSegment[];
  contactAttributeKeys: TContactAttributeKey[];
  isContactsEnabled: boolean;
  isReadOnly: boolean;
};

export const SegmentTable = async ({
  segments,
  contactAttributeKeys,
  isContactsEnabled,
  isReadOnly,
}: TSegmentTableProps) => {
  const t = await getTranslate();
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
              contactAttributeKeys={contactAttributeKeys}
              isContactsEnabled={isContactsEnabled}
              isReadOnly={isReadOnly}
            />
          ))}
        </>
      )}
    </div>
  );
};
