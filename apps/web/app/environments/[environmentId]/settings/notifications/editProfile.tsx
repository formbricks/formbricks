"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProfile, updateProfile } from "@/lib/profile";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import Button from "@/components/ui/Button";
import Image from "next/image";
import AvatarPlaceholder from "@/images/avatar-placeholder.png";

export function EditName() {
  const { profile, isLoadingProfile, isErrorProfile } = useProfile();

  if (isLoadingProfile) {
    return <LoadingSpinner />;
  }
  if (isErrorProfile) {
    return <div>Error</div>;
  }

  return (
    <div className="w-full max-w-sm items-center">
      <Label htmlFor="fullname">Full Name</Label>
      <Input type="text" id="fullname" defaultValue={profile.name} />

      <div className="mt-4">
        <Label htmlFor="email">Email</Label>
        <Input type="email" id="fullname" defaultValue={profile.email} />
      </div>
      <Button type="submit" className="mt-4" onClick={(e) => console.log(e)}>
        Update
      </Button>
    </div>
  );
}

export function EditAvatar() {
  return (
    <div>
      <Image
        src={AvatarPlaceholder}
        width="100"
        height="100"
        className="h-24 w-24 rounded-full"
        alt="Avatar placeholder"
      />
      <Button className="mt-4">Upload Image</Button>
    </div>
  );
  /*   return <div className="whitespace-pre-wrap">{JSON.stringify(profile, null, 2)}</div>; */
}
