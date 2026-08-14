import {
  CalendarDaysIcon,
  ContactIcon,
  EyeOffIcon,
  FileDigitIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  SmilePlusIcon,
  StarIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDeclaredEmbeddedFields, listReadableFields } from "@formbricks/types/embedded-data-resolver";
import { TSurveyElement, TSurveyElementId, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyHiddenFields, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getTextContentWithRecallTruncated } from "@/lib/utils/recall";
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

interface RecallItemSelectProps {
  localSurvey: TSurvey;
  elementId: TSurveyElementId;
  addRecallItem: (item: TSurveyRecallItem) => void;
  setShowRecallItemSelect: (show: boolean) => void;
  recallItems: TSurveyRecallItem[];
  selectedLanguageCode: string;
  hiddenFields: TSurveyHiddenFields;
}

export const RecallItemSelect = ({
  localSurvey,
  elementId,
  addRecallItem,
  setShowRecallItemSelect,
  recallItems,
  selectedLanguageCode,
}: RecallItemSelectProps) => {
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

  // ENG-1837: both groups are enumerated from the survey's Embedded Data definitions, derived from
  // the editor's cards (`getDeclaredEmbeddedFields`) so a rename shows here without a reload. Only the
  // `embeddedData` group of `listReadableFields` is used — its keys and labels are exactly today's
  // (storage key / field name); the element group keeps this file's own labelling, which stores the
  // raw headline HTML and searches it through `getTextContent`.
  const embeddedFields = useMemo(
    () =>
      getDeclaredEmbeddedFields({
        variables: localSurvey.variables,
        hiddenFields: localSurvey.hiddenFields,
      }),
    [localSurvey.variables, localSurvey.hiddenFields]
  );

  /**
   * The definitions joined to their picker labels, in the definitions' own order. Keyed on
   * `storageKey`, not on position: `listReadableFields` happens to emit one entry per input today,
   * but a future filter there would silently shift every label past the first drop.
   */
  const embeddedFieldEntries = useMemo(() => {
    const labelByKey = new Map(
      listReadableFields({
        blocks: [],
        embeddedData: embeddedFields,
        reservedEntries: [],
        contactAttributeKeys: [],
      }).embeddedData.map(({ key, label }) => [key, label] as const)
    );

    return embeddedFields.map(({ field, link }) => ({
      key: link.storageKey,
      // The enumerator's blank-name fallback is the key, so mirror it when a field is not listed.
      label: labelByKey.get(link.storageKey) ?? link.storageKey,
      source: field.source,
      dataType: field.dataType,
    }));
  }, [embeddedFields]);

  const hiddenFieldRecallItems = useMemo(
    () =>
      embeddedFieldEntries
        .filter(({ key, source }) => source === "ingested" && !recallItemIds.includes(key))
        .map(({ key, label }) => ({ id: key, label, type: "hiddenField" as const })),
    [embeddedFieldEntries, recallItemIds]
  );

  const variableRecallItems = useMemo(
    () =>
      embeddedFieldEntries
        .filter(({ key, source }) => source === "computed" && !recallItemIds.includes(key))
        .map(({ key, label }) => ({ id: key, label, type: "variable" as const })),
    [embeddedFieldEntries, recallItemIds]
  );

  const surveyElementRecallItems = useMemo(() => {
    const isWelcomeCard = elementId === "start";
    if (isWelcomeCard) return [];

    const isEndingCard = !elements.map((element) => element.id).includes(elementId);
    const idx = isEndingCard
      ? elements.length
      : elements.findIndex((recallElement) => recallElement.id === elementId);
    const filteredElements = elements
      .filter((element, index) => {
        const notAllowed = isNotAllowedElementType(element);
        return !recallItemIds.includes(element.id) && !notAllowed && element.id !== elementId && idx > index;
      })
      .map((element) => {
        return {
          id: element.id,
          label: element.headline[selectedLanguageCode],
          type: "element" as const,
        };
      });

    return filteredElements;
  }, [elementId, elements, recallItemIds, selectedLanguageCode]);

  const filteredRecallItems: TSurveyRecallItem[] = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return [...surveyElementRecallItems, ...hiddenFieldRecallItems, ...variableRecallItems];

    // Match the label's text content, not the label itself: an element's label is its raw headline HTML
    // (`<p class="fb-editor-paragraph">…`), so comparing against it made every query for question text
    // miss. `includes` rather than `startsWith` so a query also matches mid-headline words, and so it
    // still matches items whose displayed label is elided by the truncation below.
    return [...surveyElementRecallItems, ...hiddenFieldRecallItems, ...variableRecallItems].filter(
      (recallItem) => getTextContent(recallItem.label).toLowerCase().includes(query)
    );
  }, [surveyElementRecallItems, hiddenFieldRecallItems, variableRecallItems, searchValue]);

  const getRecallItemIcon = (recallItem: TSurveyRecallItem) => {
    switch (recallItem.type) {
      case "element": {
        const element = elements.find((element) => element.id === recallItem.id);
        if (element) {
          return elementIconMapping[element?.type as keyof typeof elementIconMapping];
        }
        return null;
      }
      case "hiddenField":
        return EyeOffIcon;
      case "variable": {
        const dataType = embeddedFieldEntries.find(({ key }) => key === recallItem.id)?.dataType;
        return dataType === "number" ? FileDigitIcon : FileTextIcon;
      }
      default:
        return null;
    }
  };

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
          {filteredRecallItems.map((recallItem, index) => {
            const IconComponent = getRecallItemIcon(recallItem);
            return (
              <DropdownMenuItem
                id={"recallItem-" + index}
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
                    (e.key === "ArrowUp" && index === 0) ||
                    (e.key === "ArrowDown" && index === filteredRecallItems.length - 1)
                  ) {
                    e.preventDefault();
                    document.getElementById("recallItemSearchInput")?.focus();
                  }
                }}>
                <div>{IconComponent && <IconComponent className="mr-2 w-4" />}</div>
                <p className="max-w-full overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                  {getTextContentWithRecallTruncated(recallItem.label).trim() || t("common.no_text_found")}
                </p>
              </DropdownMenuItem>
            );
          })}
          {filteredRecallItems.length === 0 && (
            <p className="p-2 text-sm font-medium text-slate-700">
              {t("workspace.surveys.edit.no_recall_items_found")}
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
