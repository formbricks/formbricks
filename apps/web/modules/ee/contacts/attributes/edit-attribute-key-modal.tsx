"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import * as z from "zod";
import {
  TContactAttributeDataType,
  TContactAttributeKey,
  ZContactAttributeDataType,
} from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { updateAttributeKeyAction } from "../actions";

const ZEditAttributeKeyForm = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  dataType: ZContactAttributeDataType,
});

type TEditAttributeKeyForm = z.infer<typeof ZEditAttributeKeyForm>;

interface EditAttributeKeyModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  environmentId: string;
  attributeKey: TContactAttributeKey | null;
}

export const EditAttributeKeyModal = ({
  open,
  setOpen,
  environmentId,
  attributeKey,
}: EditAttributeKeyModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<TEditAttributeKeyForm>({
    resolver: zodResolver(ZEditAttributeKeyForm),
    defaultValues: {
      name: "",
      description: "",
      dataType: "text",
    },
  });

  useEffect(() => {
    if (attributeKey) {
      reset({
        name: attributeKey.name ?? "",
        description: attributeKey.description ?? "",
        dataType: attributeKey.dataType ?? "text",
      });
    }
  }, [attributeKey, reset]);

  const dataType = watch("dataType");

  const onSubmit = async (data: TEditAttributeKeyForm) => {
    if (!attributeKey) return;

    const result = await updateAttributeKeyAction({
      id: attributeKey.id,
      environmentId,
      name: data.name,
      description: data.description,
      dataType: data.dataType,
    });

    if (result?.data) {
      toast.success("Attribute key updated successfully");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(getFormattedErrorMessage(result));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Attribute Key</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key-edit">Key</Label>
            <Input id="key-edit" value={attributeKey?.key ?? ""} disabled className="bg-slate-50" />
            <p className="text-xs text-slate-500">The key cannot be changed once created.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name-edit">Name</Label>
            <Input id="name-edit" {...register("name")} placeholder="e.g. Date of Birth" />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description-edit">Description (Optional)</Label>
            <textarea
              id="description-edit"
              {...register("description")}
              placeholder="Short description"
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataType-edit">Data Type</Label>
            <Select
              value={dataType}
              onValueChange={(val) => setValue("dataType", val as TContactAttributeDataType)}>
              <SelectTrigger id="dataType-edit">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Changing data type may affect existing data.</p>
            {errors.dataType && <p className="text-sm text-red-500">{errors.dataType.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
