import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { useTranslations } from "next-intl";
import { TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";

interface RedirectUrlFormProps {
  endingCard: TSurveyRedirectUrlCard;
  updateSurvey: (input: Partial<TSurveyRedirectUrlCard>) => void;
}

export const RedirectUrlForm = ({ endingCard, updateSurvey }: RedirectUrlFormProps) => {
  const t = useTranslations();
  return (
    <form className="mt-3 space-y-3">
      <div className="space-y-2">
        <Label>{t("common.url")}</Label>
        <Input
          id="redirectUrl"
          name="redirectUrl"
          className="bg-white"
          placeholder="https://formbricks.com"
          value={endingCard.url}
          onChange={(e) => updateSurvey({ url: e.target.value })}
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
