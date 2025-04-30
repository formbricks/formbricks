"use client";

import { getNonWhitelistedUsers } from "@/modules/organization/settings/whitelist/lib/whitelist";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { OrganizationRole } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { useCallback, useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { TOrganizationRole, ZOrganizationRole } from "@formbricks/types/memberships";
import { TUser } from "@formbricks/types/user";

interface IndividualAddTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { email: string }[]) => void;
  environmentId: string;
  membershipRole?: TOrganizationRole;
}

export const IndividualAddTab = ({ setOpen, onSubmit }: IndividualAddTabProps) => {
  const emails = ["email1", "email2", "email3", "email4"];
  const [nonWhitelistedUsers, setNonWhitelistedUsers] = useState<TUser[]>([]);
  const ZFormSchema = z.object({
    // name: ZUserName,
    // email: z.string().min(1, { message: "Email is required" }).email({ message: "Invalid email" }),
    // role: ZOrganizationRole,
    email: z.string(),
  });

  type TFormData = z.infer<typeof ZFormSchema>;
  const { t } = useTranslate();
  const form = useForm<TFormData>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      // role: "owner",
      email: "",
    },
  });

  const {
    register,
    getValues,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { isSubmitting, errors },
  } = form;

  const submitEventClass = async () => {
    const data = getValues();
    // data.role = data.role || OrganizationRole.owner;
    onSubmit([data]);
    setOpen(false);
    reset();
  };

  const fetchNonWhitelistedUsers = useCallback(async () => {
    const data = await getNonWhitelistedUsers();
    if (data) {
      setNonWhitelistedUsers(data);
    }
  }, []);

  useEffect(() => {
    fetchNonWhitelistedUsers();
  }, [fetchNonWhitelistedUsers]);

  // TODO: Add user search + dropdown with users here
  // TODO: Add button to add
  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(submitEventClass)} className="flex flex-col gap-6">
        {/* <div className="flex flex-col space-y-2">
          <Label htmlFor="memberNameInput">{t("common.full_name")}</Label>
          <Input
            id="memberNameInput"
            placeholder="e.g. Bob"
            {...register("name", { required: true, validate: (value) => value.trim() !== "" })}
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col space-y-2">
          <Label htmlFor="memberEmailInput">{t("common.email")}</Label>
          <Input
            id="memberEmailInput"
            type="email"
            placeholder="e.g. bob@work.com"
            {...register("email", { required: true })}
          />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
        </div> */}
        <Controller
          name="email"
          control={form.control}
          rules={{
            required: t("environments.wallet.form.error.address_required"),
            pattern: {
              value: /^0x[a-fA-F0-9]{40}$/,
              message: t("environments.wallet.form.error.invalid_eth_address"),
            },
          }}
          render={({ field }) => (
            <Select
              value={field.value ? field.value : undefined}
              onValueChange={(email) => {
                field.onChange(email);
                setValue("email", email);
              }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={"Select a user"} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {nonWhitelistedUsers.map((user, index) => (
                  <SelectItem
                    key={user.id}
                    value={user.email}
                    className="group font-normal hover:text-slate-900">
                    <div className="flex w-full items-center justify-start gap-2">{user.email}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />

        <div className="flex justify-between">
          <Button
            size="default"
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="default" loading={isSubmitting}>
            {t("common.invite")}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
