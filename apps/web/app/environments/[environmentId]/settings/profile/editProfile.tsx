"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";
import { useProfileMutation } from "@/lib/profile/mutateProfile";
import { useProfile } from "@/lib/profile/profile";
import { Button, ErrorComponent, Input, Label, ProfileAvatar } from "@formbricks/ui";
import Image from "next/image";
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
