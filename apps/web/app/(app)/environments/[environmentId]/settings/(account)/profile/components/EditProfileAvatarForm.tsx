"use client";

import {
  removeAvatarAction,
  updateAvatarAction,
} from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/actions";
import { handleFileUpload } from "@/app/lib/fileUpload";
import { zodResolver } from "@hookform/resolvers/zod";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Button } from "@formbricks/ui/Button";
import { FormError, FormField, FormItem, FormProvider } from "@formbricks/ui/Form";

interface EditProfileAvatarFormProps {
  session: Session;
  environmentId: string;
  imageUrl: string | null;
}

export const EditProfileAvatarForm = ({ session, environmentId, imageUrl }: EditProfileAvatarFormProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fileSchema =
    typeof window !== "undefined"
      ? z
          .instanceof(FileList)
          .refine((files) => files.length === 1, "You must select a file.")
          .refine((files) => {
            const file = files[0];
            const allowedTypes = ["image/jpeg", "image/png"];
            return allowedTypes.includes(file.type);
          }, "Invalid file type. Only JPEG and PNG are allowed.")
          .refine((files) => {
            const file = files[0];
            const maxSize = 10 * 1024 * 1024;
            return file.size <= maxSize;
          }, "File size must be less than 10MB.")
      : z.any();

  const formSchema = z.object({
    file: fileSchema,
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: zodResolver(formSchema),
  });

  const handleUpload = async (file: File, environmentId: string) => {
    setIsLoading(true);
    try {
      if (imageUrl) {
        // If avatar image already exists, then remove it before update action
        await removeAvatarAction({ environmentId });
      }
      const { url, error } = await handleFileUpload(file, environmentId);

      if (error) {
        toast.error(error);
        setIsLoading(false);
        return;
      }

      await updateAvatarAction({ avatarUrl: url });
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
      await removeAvatarAction({ environmentId });
    } catch (err) {
      toast.error("Avatar update failed. Please try again.");
    } finally {
      setIsLoading(false);
      form.reset();
    }
  };

  const onSubmit = async (data: FormValues) => {
    const file = data.file[0];
    if (file) {
      await handleUpload(file, environmentId);
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

        <ProfileAvatar userId={session.user.id} imageUrl={imageUrl} />
      </div>

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4">
          <FormField
            name="file"
            control={form.control}
            render={({ field, fieldState }) => (
              <FormItem>
                <div className="flex">
                  <Button
                    type="button"
                    size="sm"
                    className="mr-2"
                    variant={!!fieldState.error?.message ? "warn" : "secondary"}
                    onClick={() => {
                      inputRef.current?.click();
                    }}>
                    {imageUrl ? "Change Image" : "Upload Image"}
                    <input
                      type="file"
                      id="hiddenFileInput"
                      ref={(e) => {
                        field.ref(e);
                        // @ts-expect-error
                        inputRef.current = e;
                      }}
                      className="hidden"
                      accept="image/jpeg, image/png"
                      onChange={(e) => {
                        field.onChange(e.target.files);
                        form.handleSubmit(onSubmit)();
                      }}
                    />
                  </Button>

                  {imageUrl && (
                    <Button type="button" className="mr-2" variant="warn" size="sm" onClick={handleRemove}>
                      Remove Image
                    </Button>
                  )}
                </div>

                <FormError />
              </FormItem>
            )}
          />
        </form>
      </FormProvider>
    </div>
  );
};
