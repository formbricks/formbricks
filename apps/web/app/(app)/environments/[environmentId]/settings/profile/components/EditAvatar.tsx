"use client";

import { Button } from "@formbricks/ui/Button";
import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Session } from "next-auth";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Image from "next/image";
import { updateAvatarAction } from "@/app/(app)/environments/[environmentId]/settings/profile/actions";
import { useRouter } from "next/navigation";
import { handleFileUpload } from "../lib";

export function EditAvatar({ session, environmentId }: { session: Session | null; environmentId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpload = async (file: File, environmentId: string) => {
    setIsLoading(true);
    try {
      const { url, error } = await handleFileUpload(file, environmentId);

      if (error) {
        toast.error(error);
        setIsLoading(false);
        return;
      }

      await updateAvatarAction(url);
      router.refresh();
    } catch (err) {
      toast.error("Avatar update failed. Please try again.");
      setIsLoading(false);
    }

    setIsLoading(false);
  };

  return (
    <div>
      <div className="relative h-10 w-10 overflow-hidden rounded-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <svg className="h-7 w-7 animate-spin text-slate-200" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {session?.user?.imageUrl ? (
          <Image
            src={session.user.imageUrl}
            width="40"
            height="40"
            style={{
              objectFit: "cover",
            }}
            className="h-10 w-10 rounded-full"
            alt="Avatar placeholder"
          />
        ) : (
          <ProfileAvatar userId={session!.user.id} />
        )}
      </div>

      <Button
        className="mt-4"
        variant="darkCTA"
        onClick={() => {
          inputRef.current?.click();
        }}>
        Upload Image
        <input
          type="file"
          id="hiddenFileInput"
          ref={inputRef}
          className="hidden"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await handleUpload(file, environmentId);
            }
          }}
        />
      </Button>
    </div>
  );
}
