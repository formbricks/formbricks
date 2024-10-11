"use client";

import { signOut } from "next-auth/react";
import { Dispatch, SetStateAction, useState } from "react";
import toast from "react-hot-toast";
import { TUser } from "@formbricks/types/user";
import { DeleteDialog } from "../DeleteDialog";
import { Input } from "../Input";
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
      deleteWhat="account"
      onDelete={() => deleteAccount()}
      text="Before you proceed with deleting your account, please be aware of the following consequences:"
      isDeleting={deleting}
      disabled={inputValue !== user.email}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>Permanent removal of all of your personal information and data.</li>
          <li>
            If you are the owner of an organization with other admins, the ownership of that organization will
            be transferred to another admin.
          </li>
          <li>
            If you are the only member of an organization or there is no other admin present, the organization
            will be irreversibly deleted along with all associated data.
          </li>
          <li>This action cannot be undone. If it&apos;s gone, it&apos;s gone.</li>
        </ul>
        <form>
          <label htmlFor="deleteAccountConfirmation">
            Please enter <span className="font-bold">{user.email}</span> in the following field to confirm the
            definitive deletion of your account:
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
