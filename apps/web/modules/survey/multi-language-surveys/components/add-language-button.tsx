import { Language } from "@prisma/client";
import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TWorkspace } from "@formbricks/types/workspace";
import { Button } from "@/modules/ui/components/button";

interface AddLanguageButtonProps {
  onClick: () => void;
  isEditing: boolean;
  languages: Language[];
  workspace: TWorkspace;
}

export const AddLanguageButton: React.FC<AddLanguageButtonProps> = ({
  onClick,
  isEditing,
  languages,
  workspace,
}) => {
  const { t } = useTranslation();

  if (isEditing && languages.length === workspace.languages.length) {
    return (
      <Button onClick={onClick} size="sm" variant="secondary">
        <PlusIcon />
        {t("workspace.languages.add_language")}
      </Button>
    );
  }

  return null;
};
