"use client";

import { DeleteDialog } from "@/modules/ui/components/delete-dialog";
import { Input } from "@/modules/ui/components/input";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Dispatch, SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { TUser } from "@formbricks/types/user";
import { deleteUserAction } from "./actions";

interface DeleteAccountModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  user: TUser;
  isFormbricksCloud: boolean;
  formbricksLogout: () => void;
}

export const DeleteAccountModal = ({
  setOpen,
  open,
  user,
  isFormbricksCloud,
  formbricksLogout,
}: DeleteAccountModalProps) => {
  const t = useTranslations();
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
      // redirect to account deletion survey in Formbricks Cloud
      if (isFormbricksCloud) {
        await signOut({ redirect: true });
        window.location.replace("https://app.formbricks.com/s/clri52y3z8f221225wjdhsoo2");
      } else {
        await signOut({ callbackUrl: "/auth/login" });
      }
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
          <li>{t("environments.settings.profile.org_ownership_transfer")}</li>
          <li>{t("environments.settings.profile.org_deletion_warning")}</li>
          <li>{t("environments.settings.profile.warning_cannot_undo")}</li>
        </ul>
        <form>
          <label htmlFor="deleteAccountConfirmation">
            {t("environments.settings.profile.please_enter_email_to_confirm_account_deletion", {
              email: user.email,
            })}
            :
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
