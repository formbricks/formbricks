"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { Dispatch, SetStateAction, useState } from "react";
import toast from "react-hot-toast";

import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";

import { deleteUserAction } from "../actions";

export function EditAvatar({ session }) {
  return (
    <div>
      <ProfileAvatar userId={session.user.id} imageUrl={session.user.imageUrl} />

      <Button className="mt-4" variant="darkCTA" disabled={true}>
        Upload Image
      </Button>
    </div>
  );
}

interface DeleteAccountModalProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  session: Session;
  IS_FORMBRICKS_CLOUD: boolean;
}

function DeleteAccountModal({ setOpen, open, session, IS_FORMBRICKS_CLOUD }: DeleteAccountModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const deleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteUserAction();
      await formbricksLogout();
      // redirect to account deletion survey in Formbricks Cloud
      if (IS_FORMBRICKS_CLOUD) {
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
      disabled={inputValue !== session.user.email}>
      <div className="py-5">
        <ul className="list-disc pb-6 pl-6">
          <li>Permanent removal of all of your personal information and data.</li>
          <li>
            If you are the owner of a team with other admins, the ownership of that team will be transferred
            to another admin.
          </li>
          <li>
            If you are the only member of a team or there is no other admin present, the team will be
            irreversibly deleted along with all associated data.
          </li>
          <li>This action cannot be undone. If it&apos;s gone, it&apos;s gone.</li>
        </ul>
        <form>
          <label htmlFor="deleteAccountConfirmation">
            Please enter <span className="font-bold">{session.user.email}</span> in the following field to
            confirm the definitive deletion of your account:
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={session.user.email}
            className="mt-5"
            type="text"
            id="deleteAccountConfirmation"
            name="deleteAccountConfirmation"
          />
        </form>
      </div>
    </DeleteDialog>
  );
}

export function DeleteAccount({
  session,
  IS_FORMBRICKS_CLOUD,
}: {
  session: Session | null;
  IS_FORMBRICKS_CLOUD: boolean;
}) {
  const [isModalOpen, setModalOpen] = useState(false);

  if (!session) {
    return null;
  }

  return (
    <div>
      <DeleteAccountModal
        open={isModalOpen}
        setOpen={setModalOpen}
        session={session}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
      />
      <p className="text-sm text-slate-700">
        Delete your account with all personal data. <strong>This cannot be undone!</strong>
      </p>
      <Button className="mt-4" variant="warn" onClick={() => setModalOpen(!isModalOpen)}>
        Delete my account
      </Button>
    </div>
  );
}
