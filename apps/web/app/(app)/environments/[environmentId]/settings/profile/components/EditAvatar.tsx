"use client";

import { Button } from "@formbricks/ui/Button";
import { useState, useRef } from "react";
import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Session } from "next-auth";
import Image from "next/image";

export function EditAvatar({ session }: { session: Session | null }) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        alert("Only .jpg and .png files are supported.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        // 2MB
        alert("The file size should be less than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => {
        alert("Failed to read the file. Please try again.");
        reader.abort();
      };
      reader.onload = function (e) {
        if (e.target) {
          setUploadedImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  <input
    type="file"
    accept=".jpg,.png"
    ref={fileInputRef}
    style={{ display: "none" }}
    onChange={handleImageUpload}
  />;

  const openFileUploader = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      {uploadedImage ? (
        <div>
          <Image
            src={uploadedImage}
            width={100}
            height={100}
            className="h-24 w-24 rounded-full"
            alt="Uploaded Avatar"
          />
          <Button className="mt-4" variant="darkCTA" onClick={() => setUploadedImage(null)}>
            Remove Image
          </Button>
        </div>
      ) : (
        <div>
          <ProfileAvatar userId={session?.user?.id || ""} />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />
          <label>
            <Button
              className="mt-4"
              variant="darkCTA"
              disabled={uploadedImage !== null}
              onClick={openFileUploader}>
              {uploadedImage ? "Image Uploaded" : "Upload Image"}
            </Button>
          </label>
        </div>
      )}
    </div>
  );
}
