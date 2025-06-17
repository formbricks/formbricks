"use client";

import {
  removeCommunityAvatarAction,
  updateCommunityAvatarAction,
} from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/actions";
import { handleFileUpload } from "@/app/lib/fileUpload";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { FormError, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

interface EditProfileAvatarFormProps {
  session: Session;
  environmentId: string;
  communityAvatarUrl: string | null;
}

export const EditCommunityAvatarForm = ({
  session,
  environmentId,
  communityAvatarUrl,
}: EditProfileAvatarFormProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { t } = useTranslate();
  const fileSchema =
    typeof window !== "undefined"
      ? z
          .instanceof(FileList)
          .refine((files) => files.length === 1, t("environments.settings.profile.you_must_select_a_file"))
          .refine((files) => {
            const file = files[0];
            const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
            return allowedTypes.includes(file.type);
          }, t("environments.settings.profile.invalid_file_type"))
          .refine((files) => {
            const file = files[0];
            const maxSize = 10 * 1024 * 1024;
            return file.size <= maxSize;
          }, t("environments.settings.profile.file_size_must_be_less_than_10mb"))
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
      if (communityAvatarUrl) {
        // If avatar image already exists, then remove it before update action
        await removeCommunityAvatarAction({ environmentId });
      }
      const { url, error } = await handleFileUpload(file, environmentId);

      if (error) {
        toast.error(error);
        setIsLoading(false);
        return;
      }
      console.log("Avatar URL:", url);

      await updateCommunityAvatarAction({ communityAvatarUrl: url });
      router.refresh();
    } catch (err) {
      toast.error(t("environments.settings.profile.avatar_update_failed"));
      setIsLoading(false);
    }

    setIsLoading(false);
  };

  const handleRemove = async () => {
    setIsLoading(true);

    try {
      await removeCommunityAvatarAction({ environmentId });
    } catch (err) {
      toast.error(t("environments.settings.profile.avatar_update_failed"));
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

        <ProfileAvatar userId={session.user.id} imageUrl={communityAvatarUrl} />
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
                    variant={!!fieldState.error?.message ? "destructive" : "secondary"}
                    onClick={() => {
                      inputRef.current?.click();
                    }}>
                    {communityAvatarUrl
                      ? t("environments.settings.profile.change_image")
                      : t("environments.settings.profile.upload_image")}
                    <input
                      type="file"
                      id="hiddenFileInput"
                      ref={(e) => {
                        field.ref(e);
                        inputRef.current = e;
                      }}
                      className="hidden"
                      accept="image/jpeg, image/png, image/webp"
                      onChange={(e) => {
                        field.onChange(e.target.files);
                        form.handleSubmit(onSubmit)();
                      }}
                    />
                  </Button>

                  {communityAvatarUrl && (
                    <Button
                      type="button"
                      className="mr-2"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemove}>
                      {t("environments.settings.profile.remove_image")}
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
