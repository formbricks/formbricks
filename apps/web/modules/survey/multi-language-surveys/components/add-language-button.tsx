import { Language } from "@prisma/client";
import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TProject } from "@formbricks/types/project";
import { Button } from "@/modules/ui/components/button";

interface AddLanguageButtonProps {
  onClick: () => void;
  isEditing: boolean;
  languages: Language[];
  project: TProject;
}

export const AddLanguageButton: React.FC<AddLanguageButtonProps> = ({
  onClick,
  isEditing,
  languages,
  project,
}) => {
  const { t } = useTranslation();

  if (isEditing && languages.length === project.languages.length) {
    return (
      <Button onClick={onClick} size="sm" variant="secondary">
        <PlusIcon />
        {t("environments.workspace.languages.add_language")}
      </Button>
    );
  }

  return null;
};
