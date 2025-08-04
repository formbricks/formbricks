import { getLocalizedValue } from "@/lib/i18n/utils";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Label } from "@/modules/ui/components/label";
import { useTranslate } from "@tolgee/react";
import Image from "next/image";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

interface OptionIdsProps {
  question: TSurveyQuestion;
  selectedLanguageCode: string;
}

export const OptionIds = ({ question, selectedLanguageCode }: OptionIdsProps) => {
  const { t } = useTranslate();

  const renderChoiceIds = () => {
    switch (question.type) {
      case TSurveyQuestionTypeEnum.MultipleChoiceSingle:
      case TSurveyQuestionTypeEnum.MultipleChoiceMulti:
      case TSurveyQuestionTypeEnum.Ranking:
        return (
          <div className="flex flex-col gap-2">
            {question.choices.map((choice) => (
              <div key={choice.id}>
                <IdBadge id={choice.id} label={getLocalizedValue(choice.label, selectedLanguageCode)} />
              </div>
            ))}
          </div>
        );

      case TSurveyQuestionTypeEnum.PictureSelection:
        return (
          <div className="flex flex-col gap-3">
            {question.choices.map((choice) => {
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
      <div className="w-full">{renderChoiceIds()}</div>
    </div>
  );
};
