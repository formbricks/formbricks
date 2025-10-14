import { useTranslation } from "react-i18next";
import { Checkbox } from "@/modules/ui/components/checkbox";

interface DecrementQuotasCheckboxProps {
  title: string;
  checked: boolean;
  onCheckedChange: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DecrementQuotasCheckbox = ({
  title,
  checked,
  onCheckedChange,
}: DecrementQuotasCheckboxProps) => {
  const { t } = useTranslation();

  const handleCheckedChange = (checked: boolean) => {
    onCheckedChange(checked);
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-sm text-slate-900">{title}</p>
      <label htmlFor="decrementQuotas" className="flex cursor-pointer items-center">
        <Checkbox
          type="button"
          id="decrementQuotas"
          className="bg-white focus:ring-0"
          checked={checked}
          onCheckedChange={handleCheckedChange}
        />
        <span className="ml-2">{t("environments.surveys.responses.decrement_quotas")}</span>
      </label>
    </div>
  );
};
