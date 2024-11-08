"use client";

import { deleteOrganizationAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/actions";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TOrganization } from "@formbricks/types/organizations";
import { Alert, AlertDescription } from "@formbricks/ui/components/Alert";
import { Button } from "@formbricks/ui/components/Button";
import { DeleteDialog } from "@formbricks/ui/components/DeleteDialog";
import { Input } from "@formbricks/ui/components/Input";

type DeleteOrganizationProps = {
  organization: TOrganization;
  isDeleteDisabled?: boolean;
  isUserOwner?: boolean;
  isMultiOrgEnabled: boolean;
};

export const DeleteOrganization = ({
  organization,
  isDeleteDisabled = false,
  isUserOwner = false,
}: DeleteOrganizationProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations();
  const router = useRouter();

  const handleDeleteOrganization = async () => {
    setIsDeleting(true);

    try {
      await deleteOrganizationAction({ organizationId: organization.id });
      toast.success(t("environments.settings.general.organization_deleted_successfully"));
      router.push("/");
    } catch (err) {
      toast.error(t("environments.settings.general.error_deleting_organization_please_try_again"));
    }

    setIsDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  const deleteDisabledWarning = useMemo(() => {
    if (isUserOwner) return t("environments.settings.general.cannot_delete_only_organization");

    return t("environments.settings.general.only_org_owner_can_perform_action");
  }, [isUserOwner]);

  return (
    <div>
      {!isDeleteDisabled && (
        <div>
          <p className="text-sm text-slate-900">
            {t("environments.settings.general.once_its_gone_its_gone")}
          </p>
          <Button
            size="sm"
            disabled={isDeleteDisabled}
            variant="warn"
            className={`mt-4 ${isDeleteDisabled ? "ring-grey-500 ring-1 ring-offset-1" : ""}`}
            onClick={() => setIsDeleteDialogOpen(true)}>
            {t("common.delete")}
          </Button>
        </div>
      )}
      {isDeleteDisabled && (
        <Alert variant="warning">
          <AlertDescription>{deleteDisabledWarning}</AlertDescription>
        </Alert>
      )}
      <DeleteOrganizationModal
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        organizationData={organization}
        deleteOrganization={handleDeleteOrganization}
        isDeleting={isDeleting}
      />
    </div>
  );
};

interface DeleteOrganizationModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  // organizationData: { name: string; id: string; plan: string };
  organizationData: TOrganization;
  deleteOrganization: () => void;
  isDeleting?: boolean;
}

const DeleteOrganizationModal = ({
  setOpen,
  open,
  organizationData,
  deleteOrganization,
  isDeleting,
}: DeleteOrganizationModalProps) => {
  const [inputValue, setInputValue] = useState("");
  const t = useTranslations();
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <DeleteDialog
      open={open}
      setOpen={setOpen}
      deleteWhat={t("common.organization")}
      onDelete={deleteOrganization}
      text={t("environments.settings.general.delete_organization_warning")}
      disabled={inputValue !== organizationData?.name}
      isDeleting={isDeleting}>
      <div className="py-5" data-i18n="[html]content.body">
        <ul className="list-disc pb-6 pl-6">
          <li>{t("environments.settings.general.delete_organization_warning_1")}</li>
          <li>{t("environments.settings.general.delete_organization_warning_2")}</li>
        </ul>
        <form onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="deleteOrganizationConfirmation">
            {t("environments.settings.general.delete_organization_warning_3", {
              organizationName: organizationData?.name,
            })}
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={organizationData?.name}
            className="mt-5"
            type="text"
            id="deleteOrganizationConfirmation"
            name="deleteOrganizationConfirmation"
          />
        </form>
      </div>
    </DeleteDialog>
  );
};
