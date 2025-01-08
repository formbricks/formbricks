import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { RecallWrapper } from "@/modules/surveys/components/QuestionFormInput/components/RecallWrapper";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { useTranslations } from "next-intl";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSurvey, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface RedirectUrlFormProps {
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  endingCard: TSurveyRedirectUrlCard;
  updateSurvey: (input: Partial<TSurveyRedirectUrlCard>) => void;
  locale: TUserLocale;
  contactAttributeKeys: TContactAttributeKey[];
}

export const RedirectUrlForm = ({
  localSurvey,
  contactAttributeKeys,
  endingCard,
  updateSurvey,
  selectedLanguageCode,
  locale,
}: RedirectUrlFormProps) => {
  const t = useTranslations();
  return (
    <form className="mt-3 space-y-3">
      <div className="space-y-2">
        <Label>{t("common.url")}</Label>
        <RecallWrapper
          value={endingCard.url ?? ""}
          questionId={endingCard.id}
          onChange={(val, recallItems, fallbacks) => {
            console.log("from recall wrapper", val, recallItems, fallbacks);
          }}
          contactAttributeKeys={contactAttributeKeys}
          isRecallAllowed
          localSurvey={localSurvey}
          usedLanguageCode={"default"}
          render={({ value, onChange, highlightedJSX, children }) => {
            return (
              <div className="relative flex flex-col gap-2">
                {highlightedJSX}
                <Input
                  id="redirectUrl"
                  name="redirectUrl"
                  className="bg-white"
                  placeholder="https://formbricks.com"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                />
                {children}
              </div>
            );
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.label")}</Label>
        <Input
          id="redirectUrlLabel"
          name="redirectUrlLabel"
          className="bg-white"
          placeholder="Formbricks App"
          value={endingCard.label}
          onChange={(e) => updateSurvey({ label: e.target.value })}
        />
      </div>
    </form>
  );
};
