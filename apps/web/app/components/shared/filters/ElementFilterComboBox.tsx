import { t } from "@/lib/i18n";

const getLabel = (key: string) => t(`filters.${key}`);

{options.map((option) => (
  <option key={option} value={option}>
    {getLabel(option)}
  </option>
))}
