import Image from "next/image";
import { useTranslation } from "react-i18next";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { isExternalImageSrc } from "@/lib/image-hosts";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Label } from "@/modules/ui/components/label";

interface OptionIdsProps {
  type: "element";
  element: TSurveyElement;
}

/**
 * The ids of an element's choices, for an author who needs to address one from outside the editor.
 *
 * The `variables` variant went with the Variables card (ENG-1851): the Embedded Data card shows each
 * field's storage key on the row itself, so a second list of the same ids under the card had nothing
 * left to add.
 */
export const OptionIds = (props: OptionIdsProps) => {
  const { t } = useTranslation();
  const selectedLanguageCode = "default";

  const renderChoiceIds = (element: TSurveyElement, selectedLanguageCode: string) => {
    switch (element.type) {
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
      case TSurveyElementTypeEnum.Ranking:
        return (
          <div className="flex flex-col gap-2">
            {element.choices.map((choice) => (
              <div key={choice.id}>
                <IdBadge id={choice.id} label={getLocalizedValue(choice.label, selectedLanguageCode)} />
              </div>
            ))}
          </div>
        );

      case TSurveyElementTypeEnum.PictureSelection:
        return (
          <div className="flex flex-col gap-3">
            {element.choices.map((choice) => {
              const imageUrl = choice.imageUrl;
              if (!imageUrl) return null;
              return (
                <div key={choice.id} className="flex items-center gap-3">
                  <div className="relative h-24 w-40 overflow-hidden rounded-lg bg-gray-100">
                    <Image
                      src={imageUrl}
                      alt={`Choice ${choice.id}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 160px"
                      style={{ objectFit: "cover" }}
                      quality={75}
                      className="rounded-lg transition-opacity duration-200"
                      unoptimized={isExternalImageSrc(imageUrl)}
                    />
                  </div>
                  <IdBadge id={choice.id} />
                </div>
              );
            })}
          </div>
        );

      default:
        return <></>;
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-700">{t("common.option_ids")}</Label>
      <div className="w-full">{renderChoiceIds(props.element, selectedLanguageCode)}</div>
    </div>
  );
};
