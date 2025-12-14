"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import * as z from "zod";
import {
  TContactAttributeDataType,
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
import { createAttributeKeyAction } from "../actions";

const ZCreateAttributeKeyForm = z.object({
  key: z.string().min(1, "Key is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  dataType: ZContactAttributeDataType,
});

type TCreateAttributeKeyForm = z.infer<typeof ZCreateAttributeKeyForm>;

interface CreateAttributeKeyModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  environmentId: string;
}

export const CreateAttributeKeyModal = ({ open, setOpen, environmentId }: CreateAttributeKeyModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<TCreateAttributeKeyForm>({
    resolver: zodResolver(ZCreateAttributeKeyForm),
    defaultValues: {
      key: "",
      name: "",
      description: "",
      dataType: "text",
    },
  });

  const dataType = watch("dataType");

  const onSubmit = async (data: TCreateAttributeKeyForm) => {
    const result = await createAttributeKeyAction({
      environmentId,
      key: data.key,
      name: data.name,
      description: data.description,
      dataType: data.dataType,
    });

    if (result?.data) {
      toast.success("Attribute key created successfully");
      reset();
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
          <DialogTitle>Create Attribute Key</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input id="key" {...register("key")} placeholder="e.g. date_of_birth" />
            {errors.key && <p className="text-sm text-red-500">{errors.key.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} placeholder="e.g. Date of Birth" />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <textarea
              id="description"
              {...register("description")}
              placeholder="Short description"
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataType">Data Type</Label>
            <Select
              value={dataType}
              onValueChange={(val) => setValue("dataType", val as TContactAttributeDataType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
            {errors.dataType && <p className="text-sm text-red-500">{errors.dataType.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create Key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
