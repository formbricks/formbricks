"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ProfileAvatar } from "@/components/ui/Avatars";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";
import { PROFILE_API_ENDPOINT } from "@/lib/constants";
import { fetchRessource, updateRessource } from "@/lib/fetcher";
import Image from "next/image";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

export function EditName() {
  const { register, handleSubmit } = useForm();
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: isErrorProfile,
  } = useSWR(PROFILE_API_ENDPOINT, fetchRessource);

  const { trigger: triggerProfileMutate, isMutating: isMutatingProfile } = useSWRMutation(
    PROFILE_API_ENDPOINT,
    updateRessource
  );

  if (isLoadingProfile) {
    return <LoadingSpinner />;
  }
  if (isErrorProfile) {
    return <div>Error</div>;
  }

  return (
    <form
      className="w-full max-w-sm items-center"
      onSubmit={handleSubmit((data) => {
        triggerProfileMutate(data);
      })}>
      <Label htmlFor="fullname">Full Name</Label>
      <Input type="text" id="fullname" defaultValue={profile.name} {...register("name")} />

      <div className="mt-4">
        <Label htmlFor="email">Email</Label>
        <Input type="email" id="fullname" defaultValue={profile.email} />
      </div>
      <Button type="submit" className="mt-4" loading={isMutatingProfile}>
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

      <Button className="mt-4" disabled={true}>
        Upload Image
      </Button>
    </div>
  );
}
