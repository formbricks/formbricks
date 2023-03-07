"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useProfile } from "@/lib/profile";

export function EditProductName() {
  const { profile, isLoadingProfile, isErrorProfile } = useProfile();

  if (isLoadingProfile) {
    return <LoadingSpinner />;
  }
  if (isErrorProfile) {
    return <div>Error</div>;
  }

  return (
    <div className="w-full max-w-sm items-center">
      <Input type="text" id="fullname" defaultValue={profile.name} />
      <Button type="submit" className="mt-4" onClick={(e) => console.log(e)}>
        Update
      </Button>
    </div>
  );
}

export function EditWaitingTime() {
  const { isLoadingProfile, isErrorProfile } = useProfile();

  if (isLoadingProfile) {
    return <LoadingSpinner />;
  }
  if (isErrorProfile) {
    return <div>Error</div>;
  }

  return (
    <div className="w-full max-w-sm items-center">
      <Input type="text" id="fullname" defaultValue="7" />
      <Button type="submit" className="mt-4" onClick={(e) => console.log(e)}>
        Update
      </Button>
    </div>
  );
}
