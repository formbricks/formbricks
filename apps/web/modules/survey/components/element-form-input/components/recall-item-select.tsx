import {
  CalendarDaysIcon,
  ContactIcon,
  GaugeIcon,
  HomeIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  SmilePlusIcon,
  StarIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RESERVED_FIELD_CATALOG,
  getSurveyEmbeddedFields,
  listMidSurveyReservedEntries,
  listReadableFields,
} from "@formbricks/types/embedded-data-resolver";
import { TSurveyElement, TSurveyElementId, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getTextContentWithRecallTruncated } from "@/lib/utils/recall";
import {
  EMBEDDED_FIELD_ICON_BY_DATA_TYPE,
  getReservedFieldIcon,
  getReservedFieldLabel,
} from "@/modules/embedded-data/lib/field-display";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";

const elementIconMapping = {
  openText: MessageSquareTextIcon,
  multipleChoiceSingle: Rows3Icon,
  multipleChoiceMulti: ListIcon,
  rating: StarIcon,
  nps: PresentationIcon,
  date: CalendarDaysIcon,
  cal: PhoneIcon,
  address: HomeIcon,
  contactInfo: ContactIcon,
  ranking: ListOrderedIcon,
  csat: SmilePlusIcon,
  ces: GaugeIcon,
};

/**
 * One row of the picker. `TSurveyRecallItem` is what gets written into the text, so the two extras
 * live here and go no further: the icon is display-only, and `secondaryLabel` is a shared Embedded
 * Data field's library key, which labels the row but is not part of the token.
 */
interface TRecallOption extends TSurveyRecallItem {
  icon: LucideIcon | null;
  secondaryLabel?: string;
}

/** A labelled section of the picker, with each row's position in the flat keyboard order. */
interface TRecallGroup {
  label: string;
  options: (TRecallOption & { index: number })[];
}

interface RecallItemSelectProps {
  localSurvey: TSurvey;
  elementId: TSurveyElementId;
  addRecallItem: (item: TSurveyRecallItem) => void;
  setShowRecallItemSelect: (show: boolean) => void;
  recallItems: TSurveyRecallItem[];
  selectedLanguageCode: string;
}

export const RecallItemSelect = ({
  localSurvey,
  elementId,
  addRecallItem,
  setShowRecallItemSelect,
  recallItems,
  selectedLanguageCode,
}: Readonly<RecallItemSelectProps>) => {
  const [searchValue, setSearchValue] = useState("");
  const { t } = useTranslation();
  const isNotAllowedElementType = (element: TSurveyElement): boolean => {
    return (
      element.type === TSurveyElementTypeEnum.FileUpload ||
      element.type === TSurveyElementTypeEnum.CTA ||
      element.type === TSurveyElementTypeEnum.Consent ||
      element.type === TSurveyElementTypeEnum.PictureSelection ||
      element.type === TSurveyElementTypeEnum.Cal ||
      element.type === TSurveyElementTypeEnum.Matrix
    );
  };

  const elements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  const recallItemIds = useMemo(() => {
    return recallItems.map((recallItem) => recallItem.id);
  }, [recallItems]);

  // ENG-1837: both groups are enumerated from the survey's Embedded Data definitions. ENG-2628: off
  // the rows, which the editor's cards now edit directly, so a rename still shows here without a
  // reload. Only the `embeddedData` group of `listReadableFields` is used — its keys and labels are
  // exactly today's (storage key / field name); the element group keeps this file's own labelling,
  // which stores the raw headline HTML and searches it through `getTextContent`.
  const embeddedFields = useMemo(() => getSurveyEmbeddedFields(localSurvey), [localSurvey]);

  /**
   * The definitions joined to their picker labels, in the definitions' own order. Keyed on
   * `storageKey`, not on position: `listReadableFields` happens to emit one entry per input today,
   * but a future filter there would silently shift every label past the first drop.
   */
  const embeddedFieldEntries = useMemo(() => {
    const readableByKey = new Map(
      listReadableFields({
        blocks: [],
        embeddedData: embeddedFields,
        reservedEntries: [],
        contactAttributeKeys: [],
      }).embeddedData.map((readable) => [readable.key, readable] as const)
    );

    return embeddedFields.map(({ field, link }) => {
      const readable = readableByKey.get(link.storageKey);
      return {
        key: link.storageKey,
        // The enumerator's blank-name fallback is the key, so mirror it when a field is not listed.
        label: readable?.label ?? link.storageKey,
        secondaryLabel: readable?.secondaryLabel,
        source: field.source,
        dataType: field.dataType,
      };
    });
  }, [embeddedFields]);

  /**
   * **One Embedded Data group** (ENG-1853), where the picker used to list variables and hidden
   * fields as two runs of an undifferentiated flat list. `type` still distinguishes them — it is
   * written into the recall item and read back by `resolveRecallItemLabel`, whose ingested-first
   * precedence a merged type would destroy — but nothing in the UI does any more.
   */
  const embeddedDataRecallItems: TRecallOption[] = useMemo(
    () =>
      embeddedFieldEntries
        .filter(({ key }) => !recallItemIds.includes(key))
        .map(({ key, label, secondaryLabel, source, dataType }) => ({
          id: key,
          label,
          secondaryLabel,
          type: source === "computed" ? ("variable" as const) : ("hiddenField" as const),
          icon: EMBEDDED_FIELD_ICON_BY_DATA_TYPE[dataType],
        })),
    [embeddedFieldEntries, recallItemIds]
  );

  /**
   * Reserved fields (ENG-1840). `listMidSurveyReservedEntries` applies both gates: it drops
   * server-derived entries — recall renders while the respondent is still answering, so `country` or
   * `durationSeconds` could only ever render as their fallback text — and it drops any entry this
   * survey already declares under the same name, which would otherwise show twice with no way to
   * tell the rows apart. Labels come from `getReservedFieldLabel` (ENG-1853), the same helper the
   * response table and the response filter use, so this picker offers `URL` where they show `URL`
   * rather than the `Url` a title-case of the catalog name produces.
   */
  const reservedRecallItems: TRecallOption[] = useMemo(() => {
    const entries = listMidSurveyReservedEntries(RESERVED_FIELD_CATALOG, [
      ...embeddedFieldEntries.map(({ key }) => key),
      // Element ids shadow reserved entries too: an element answered under the id `country` writes
      // `responseData.country`, which the merged value map spreads over the reserved projection.
      ...elements.map((element) => element.id),
    ]);

    return entries
      .filter((entry) => !recallItemIds.includes(entry.name))
      .map((entry) => ({
        id: entry.name,
        label: getReservedFieldLabel(entry.name, t),
        type: "reserved" as const,
        icon: getReservedFieldIcon(entry.name),
      }));
  }, [embeddedFieldEntries, elements, recallItemIds, t]);

  const surveyElementRecallItems: TRecallOption[] = useMemo(() => {
    const isWelcomeCard = elementId === "start";
    if (isWelcomeCard) return [];

    const isEndingCard = !elements.map((element) => element.id).includes(elementId);
    const idx = isEndingCard
      ? elements.length
      : elements.findIndex((recallElement) => recallElement.id === elementId);

    return elements
      .filter((element, index) => {
        const notAllowed = isNotAllowedElementType(element);
        return !recallItemIds.includes(element.id) && !notAllowed && element.id !== elementId && idx > index;
      })
      .map((element) => ({
        id: element.id,
        label: element.headline[selectedLanguageCode],
        type: "element" as const,
        icon: elementIconMapping[element.type as keyof typeof elementIconMapping] ?? null,
      }));
  }, [elementId, elements, recallItemIds, selectedLanguageCode]);

  /**
   * The three groups, filtered by the search box and numbered across group boundaries.
   *
   * The index is assigned here rather than during render because it is the keyboard order: arrow
   * keys walk `recallItem-<n>` by id, so it has to run continuously through the whole visible list
   * no matter which group a row sits in. Empty groups are dropped, so a search that matches nothing
   * in Embedded Data does not leave its heading floating over the next group's rows.
   *
   * Matching is on the label's text content, not the label itself: an element's label is its raw
   * headline HTML (`<p class="fb-editor-paragraph">…`), so comparing against it made every query for
   * question text miss. `includes` rather than `startsWith` so a query also matches mid-headline
   * words, and so it still matches rows whose displayed label is elided by the truncation below. A
   * shared field also matches on its library key, which is the spelling someone who knows the URL
   * parameter would type.
   */
  const filteredGroups: TRecallGroup[] = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const matches = (option: TRecallOption): boolean =>
      query === "" ||
      getTextContent(option.label).toLowerCase().includes(query) ||
      (option.secondaryLabel ?? "").toLowerCase().includes(query);

    let index = 0;
    return [
      { label: t("common.questions"), options: surveyElementRecallItems },
      { label: t("common.embedded_data"), options: embeddedDataRecallItems },
      { label: t("common.auto_captured"), options: reservedRecallItems },
    ]
      .map((group) => ({
        label: group.label,
        options: group.options.filter(matches).map((option) => ({ ...option, index: index++ })),
      }))
      .filter((group) => group.options.length > 0);
  }, [surveyElementRecallItems, embeddedDataRecallItems, reservedRecallItems, searchValue, t]);

  const visibleCount = useMemo(
    () => filteredGroups.reduce((count, group) => count + group.options.length, 0),
    [filteredGroups]
  );

  return (
    <DropdownMenu defaultOpen={true} modal={true}>
      <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
        <div className="flex w-full items-center justify-between overflow-hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="flex w-96 flex-col gap-2 bg-slate-50 p-3 text-xs text-slate-700"
        align="start"
        side="bottom"
        data-recall-dropdown>
        <p className="font-medium">{t("workspace.surveys.edit.recall_information_from")}</p>
        <Input
          id="recallItemSearchInput"
          placeholder="Search options"
          className="w-full bg-white"
          onChange={(e) => setSearchValue(e.target.value)}
          autoFocus={true}
          value={searchValue}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              document.getElementById("recallItem-0")?.focus();
            }
          }}
        />
        <div className="max-h-72 overflow-x-hidden overflow-y-auto">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pt-2 pb-1 text-xs font-medium text-slate-500">{group.label}</p>
              {group.options.map((recallItem) => {
                const IconComponent = recallItem.icon;
                return (
                  <DropdownMenuItem
                    id={"recallItem-" + recallItem.index}
                    key={recallItem.id}
                    title={recallItem.type}
                    onSelect={() => {
                      addRecallItem({ id: recallItem.id, label: recallItem.label, type: recallItem.type });
                      setShowRecallItemSelect(false);
                    }}
                    autoFocus={false}
                    className="flex w-full cursor-pointer items-center rounded-md p-2 focus:bg-slate-200 focus:outline-hidden"
                    onKeyDown={(e) => {
                      if (
                        (e.key === "ArrowUp" && recallItem.index === 0) ||
                        (e.key === "ArrowDown" && recallItem.index === visibleCount - 1)
                      ) {
                        e.preventDefault();
                        document.getElementById("recallItemSearchInput")?.focus();
                      }
                    }}>
                    <div>{IconComponent && <IconComponent className="mr-2 w-4" />}</div>
                    <p className="max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                      {getTextContentWithRecallTruncated(recallItem.label).trim() ||
                        t("common.no_text_found")}
                    </p>
                    {/*
                      A shared field's library key, dim and right-aligned so a column of them can be
                      scanned on its own, in mono because that is what the identifier looks like
                      where it is used — a URL parameter, an integration payload key. A survey-only
                      field has no library key and renders one string.
                    */}
                    {recallItem.secondaryLabel && (
                      <span className="ml-auto max-w-[45%] truncate pl-2 font-mono text-xs text-slate-400">
                        {recallItem.secondaryLabel}
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
          {visibleCount === 0 && (
            <p className="p-2 text-sm font-medium text-slate-700">
              {t("workspace.surveys.edit.no_recall_items_found")}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
