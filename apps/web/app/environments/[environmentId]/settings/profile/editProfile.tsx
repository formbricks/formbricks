"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";
import { formbricksLogout } from "@/lib/formbricks";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { useProfile } from "@/lib/profile/profile";
import { deleteProfile } from "@/lib/users/users";
import { Button, ErrorComponent, Input, Label, ProfileAvatar } from "@formbricks/ui";
import { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { Dispatch, SetStateAction, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

export function EditName() {
  const { register, handleSubmit } = useForm();
  const { profile, isLoadingProfile, isErrorProfile } = useProfile();

  const { triggerProfileMutate, isMutatingProfile } = useProfileMutation();

  if (isLoadingProfile) {
    return <LoadingSpinner />;
  }
  if (isErrorProfile) {
    return <ErrorComponent />;
  }

  return (
    <form
      className="w-full max-w-sm items-center"
      onSubmit={handleSubmit((data) => {
        triggerProfileMutate(data)
          .then(() => {
            toast.success("Your name was updated successfully.");
          })
          .catch((error) => {
            toast.error(`Error: ${error.message}`);
          });
      })}>
      <Label htmlFor="fullname">Full Name</Label>
      <Input type="text" id="fullname" defaultValue={profile.name} {...register("name")} />

      <div className="mt-4">
        <Label htmlFor="email">Email</Label>
        <Input type="email" id="fullname" defaultValue={profile.email} disabled />
      </div>
      <Button type="submit" variant="darkCTA" className="mt-4" loading={isMutatingProfile}>
        Update
      </Button>
    </form>
  );
}

export function EditAvatar({ session }) {
  return (
    <div>
      {session?.user?.image ? (
        <Image
          src={AvatarPlaceholder}
          width="100"
          height="100"
          className="h-24 w-24 rounded-full"
          alt="Avatar placeholder"
        />
      ) : (
        <ProfileAvatar userId={session?.user?.id} />
      )}

      <Button className="mt-4" variant="darkCTA" disabled={true}>
        Upload Image
      </Button>
    </div>
  );
}

interface DeleteAccounModaltProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  session: Session;
}

function DeleteAccountModal({ setOpen, open, session }: DeleteAccounModaltProps) {
  const [deleting, setDeleting] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const deleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteProfile();
      await signOut();
      await formbricksLogout();
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
        <p>
          Deleting your account will result in the permanent removal of all your personal information, saved
          preferences, and access to team data. If you are the owner of a team with other admins, the
          ownership of that team will be transferred to another admin.
        </p>
        <p className="py-5">
          Please note, however, that if you are the only member of a team or there is no other admin present,
          the team will be irreversibly deleted along with all associated data.
        </p>
        <form>
          <label htmlFor="deleteAccountConfirmation">
            Please enter <span className="font-bold">{session.user.email}</span> in the following field to
            confirm the definitive deletion of your account.
          </label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
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

export function DeleteAccount({ session }: { session: Session | null }) {
  const [isModalOpen, setModalOpen] = useState(false);

  if (!session) {
    return null;
  }

  return (
    <div>
      <DeleteAccountModal open={isModalOpen} setOpen={setModalOpen} session={session} />
      <Button className="mt-4" variant="warn" onClick={() => setModalOpen(!isModalOpen)}>
        Delete my account
      </Button>
    </div>
  );
}
