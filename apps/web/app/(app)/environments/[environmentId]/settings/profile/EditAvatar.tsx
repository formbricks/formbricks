"use client";

import { Button, ProfileAvatar } from "@formbricks/ui";
import { Session } from "next-auth";

export function EditAvatar({ session }: { session: Session | null }) {
  return (
    <div>
      {/* {session?.user?.image ? (
        <Image
          src={AvatarPlaceholder}
          width="100"
          height="100"
          className="h-24 w-24 rounded-full"
          alt="Avatar placeholder"
        />
      ) : (
        <ProfileAvatar userId={session!.user.id} />
      )} */}
      <ProfileAvatar userId={session!.user.id} />

      <Button className="mt-4" variant="darkCTA" disabled={true}>
        Upload Image
      </Button>
    </div>
  );
}
