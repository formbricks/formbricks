"use client";

import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { T } from "@tolgee/react";
import { signOut } from "next-auth/react";
import { Dispatch, SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { deleteUserAction } from "./actions";

interface DeleteAccountModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  user: TUser;
  organizationsWithSingleOwner: TOrganization[];
  formbricksLogout: () => Promise<void>;
}

export const DeleteAccountModal = ({
  setOpen,
  open,
  user,
  formbricksLogout,
  organizationsWithSingleOwner,
}: DeleteAccountModalProps) => {
  const { t } = useTranslate();
  const [deleting, setDeleting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const deleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteUserAction();
      await formbricksLogout();
      await signOut({ callbackUrl: "/auth/login" });
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  };

  return (
    <DeleteDialog
      open={open}
      setOpen={setOpen}
      deleteWhat={t("common.account")}
      onDelete={() => deleteAccount()}
      text={t("environments.settings.profile.account_deletion_consequences_warning")}
      isDeleting={deleting}
      disabled={inputValue !== user.email}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>
            {t(
              "environments.settings.profile.permanent_removal_of_all_of_your_personal_information_and_data"
            )}
          </li>
          {organizationsWithSingleOwner.length > 0 && (
            <li>
              <T keyName="environments.settings.profile.organizations_delete_message" params={{ b: <b /> }} />
            </li>
          )}
          {organizationsWithSingleOwner.length > 0 && (
            <ul className="ml-4" style={{ listStyleType: "circle" }}>
              {organizationsWithSingleOwner.map((organization) => {
                if (organization.name) {
                  return <li key={organization.name}>{organization.name}</li>;
                }
              })}
            </ul>
          )}
          <li>{t("environments.settings.profile.warning_cannot_undo")}</li>
        </ul>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await deleteAccount();
          }}>
          <label htmlFor="deleteAccountConfirmation">
            {t("environments.settings.profile.please_enter_email_to_confirm_account_deletion", {
              email: user.email,
            })}
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={user.email}
            className="mt-5"
            type="text"
            id="deleteAccountConfirmation"
            name="deleteAccountConfirmation"
          />
        </form>
      </div>
    </DeleteDialog>
  );
};
