"use client";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";
import { formbricksLogout } from "@/lib/formbricks";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { useProfile } from "@/lib/profile/profile";
import { deleteProfile } from "@/lib/users/users";
import { Button, ErrorComponent, Input, Label, ProfileAvatar } from "@formbricks/ui";
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
}

function DeleteAccountModal({ setOpen, open }: DeleteAccounModaltProps) {
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteProfile();
      await signOut();
      await formbricksLogout();
    } catch (error) {
      toast.error("semething went wrong");
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
      text="Deleting your account will permanently remove all your personal information, saved preferences, and activity history associated with this account."
      isDeleting={deleting}
    />
  );
}

export function DeleteAccount() {
  const [isModalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <DeleteAccountModal open={isModalOpen} setOpen={setModalOpen} />
      <Button className="mt-4" variant="warn" onClick={() => setModalOpen(!isModalOpen)}>
        Delete my account
      </Button>
    </div>
  );
}
