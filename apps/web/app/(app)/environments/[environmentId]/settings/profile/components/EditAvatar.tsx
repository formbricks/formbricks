"use client";

import { Button } from "@formbricks/ui/Button";
import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Session } from "next-auth";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Image from "next/image";
import { updateAvatarAction } from "@/app/(app)/environments/[environmentId]/settings/profile/actions";
import { useRouter } from "next/navigation";

export function EditAvatar({ session, environmentId }: { session: Session | null; environmentId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB.");
      return;
    }

    const payload = {
      fileName: file.name,
      fileType: file.type,
      environmentId,
    };

    setIsLoading(true);
    const response = await fetch("/api/v1/management/storage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    const json = await response.json();

    const { data } = json;
    const { signedUrl, fileUrl, signingData, presignedFields } = data;

    let requestHeaders: Record<string, string> = {};

    if (signingData) {
      const { signature, timestamp, uuid } = signingData;

      requestHeaders = {
        fileType: file.type,
        fileName: file.name,
        environmentId: environmentId ?? "",
        signature,
        timestamp,
        uuid,
      };
    }

    const formData = new FormData();

    if (presignedFields) {
      Object.keys(presignedFields).forEach((key) => {
        formData.append(key, presignedFields[key]);
      });
    }

    // Add the actual file to be uploaded
    formData.append("file", file);

    const uploadResponse = await fetch(signedUrl, {
      method: "POST",
      ...(signingData ? { headers: requestHeaders } : {}),
      body: formData,
    });

    if (!uploadResponse.ok) {
      // throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      setIsLoading(false);
      toast.error("Upload failed. Please try again.");
      return;
    }

    setIsLoading(false);
    // Update the user's avatar
    await updateAvatarAction(fileUrl);
    router.refresh();
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

        {session?.user?.image ? (
          <Image
            src={session.user.image}
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
              try {
                await handleFileUpload(file);
              } catch (err) {
                toast.error("Upload failed. Please try again.");
                setIsLoading(false);
              }
            }
          }}
        />
      </Button>
    </div>
  );
}
