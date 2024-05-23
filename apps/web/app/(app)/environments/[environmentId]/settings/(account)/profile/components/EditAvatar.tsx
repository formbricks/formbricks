"use client";

import {
  removeAvatarAction,
  updateAvatarAction,
} from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/actions";
import { handleFileUpload } from "@/app/lib/fileUpload";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Button } from "@formbricks/ui/Button";

export const EditAvatar = ({ session, environmentId }: { session: Session; environmentId: string }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpload = async (file: File, environmentId: string) => {
    setIsLoading(true);
    try {
      if (session?.user.imageUrl) {
        // If avatar image already exist, then remove it before update action
        await removeAvatarAction(environmentId);
      }
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

  const handleRemove = async () => {
    setIsLoading(true);

    try {
      await removeAvatarAction(environmentId);
    } catch (err) {
      toast.error("Avatar update failed. Please try again.");
    } finally {
      setIsLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
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

        <ProfileAvatar userId={session.user.id} imageUrl={session.user.imageUrl} />
      </div>

      <div className="mt-4">
        <Button
          size="sm"
          className="mr-2"
          variant="secondary"
          onClick={() => {
            inputRef.current?.click();
          }}>
          {session?.user.imageUrl ? "Change Image" : "Upload Image"}
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
        {session?.user?.imageUrl && (
          <Button className="mr-2" variant="warn" size="sm" onClick={handleRemove}>
            Remove Image
          </Button>
        )}
      </div>
    </div>
  );
};
