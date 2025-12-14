"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar1Icon, HashIcon, TagIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { createAttributeKeyAction } from "../actions";

interface CreateAttributeKeyModalProps {
  environmentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ZAttributeKeyInput = z.object({
  key: z.string().min(1, { message: "Key is required" }),
  name: z.string().optional(),
  description: z.string().optional(),
  dataType: z.enum(["text", "number", "date"]),
});

type TAttributeKeyInput = z.infer<typeof ZAttributeKeyInput>;

export function CreateAttributeKeyModal({ environmentId, open, setOpen }: CreateAttributeKeyModalProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const form = useForm<TAttributeKeyInput>({
    resolver: zodResolver(ZAttributeKeyInput),
    defaultValues: {
      key: "",
      name: "",
      description: "",
      dataType: "text",
    },
  });

  const onSubmit = async (data: TAttributeKeyInput) => {
    try {
      const result = await createAttributeKeyAction({
        environmentId,
        key: data.key,
        name: data.name || undefined,
        description: data.description || undefined,
        dataType: data.dataType,
      });

      if (result?.data) {
        toast.success(t("environments.contacts.attribute_key_created_successfully"));
        form.reset();
        setOpen(false);
        router.refresh();
      } else {
        const errorMessage = getFormattedErrorMessage(result);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("environments.contacts.create_attribute_key")}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("environments.contacts.attribute_key")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="signUpDate" autoFocus />
                      </FormControl>
                      <FormDescription>
                        {t("environments.contacts.attribute_key_description")}
                      </FormDescription>
                      <FormError />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("common.name")} ({t("common.optional")})
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Sign Up Date" />
                      </FormControl>
                      <FormDescription>
                        {t("environments.contacts.attribute_name_description")}
                      </FormDescription>
                      <FormError />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dataType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("environments.contacts.data_type")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="text">
                          <div className="flex items-center gap-2">
                            <TagIcon className="h-4 w-4" />
                            <span>{t("common.text")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="number">
                          <div className="flex items-center gap-2">
                            <HashIcon className="h-4 w-4" />
                            <span>{t("common.number")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="date">
                          <div className="flex items-center gap-2">
                            <Calendar1Icon className="h-4 w-4" />
                            <span>{t("common.date")}</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>{t("environments.contacts.data_type_description")}</FormDescription>
                    <FormError />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("common.description")} ({t("common.optional")})
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("environments.contacts.attribute_description_placeholder")}
                      />
                    </FormControl>
                    <FormError />
                  </FormItem>
                )}
              />
            </form>
          </FormProvider>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              form.reset();
              setOpen(false);
            }}
            disabled={form.formState.isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={form.handleSubmit(onSubmit)} loading={form.formState.isSubmitting}>
            {t("environments.contacts.create_attribute_key")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
