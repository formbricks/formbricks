"use client";

// import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { getNonWhitelistedUsersAction } from "@/modules/organization/settings/whitelist/actions";
import { Button } from "@/modules/ui/components/button";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { Label } from "@/modules/ui/components/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { useCallback, useEffect, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface IndividualAddTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { email: string }[]) => void;
  environmentId: string;
  membershipRole?: TOrganizationRole;
  organizationId: string;
}

export const IndividualAddTab = ({ setOpen, onSubmit, environmentId }: IndividualAddTabProps) => {
  const [nonWhitelistedUsers, setNonWhitelistedUsers] = useState<TUserWhitelistInfo[]>([]);
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
    defaultValues: {},
  });

  const {
    // register,
    getValues,
    handleSubmit,
    setValue,
    reset,
    // watch,
    formState: { isSubmitting }, //, errors
  } = form;

  const submitEventClass = async () => {
    const data = getValues();
    console.log("Submit data", data);
    // data.role = data.role || OrganizationRole.owner;
    onSubmit([data]);
    setOpen(false);
    reset();
  };

  const fetchNonWhitelistedUsers = useCallback(async () => {
    const data = await getNonWhitelistedUsersAction({
      take: 10,
      skip: 0,
      searchQuery: "",
      organizationId: environmentId,
    });
    if (data && data.data) {
      setNonWhitelistedUsers(data.data);
    }
  }, []);

  useEffect(() => {
    fetchNonWhitelistedUsers();
  }, [fetchNonWhitelistedUsers]);

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(submitEventClass)} className="flex flex-col gap-6">
        <div className="flex flex-col space-y-2">
          <Label>Find user by email:</Label>
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
              <InputCombobox
                id="user-email-combobox"
                comboboxClasses="min-w-full !max-w-full"
                options={nonWhitelistedUsers.map((user) => ({
                  label: user.email,
                  value: user.email,
                }))}
                value={field.value ?? ""}
                onChangeValue={(val) => {
                  field.onChange(val);
                  setValue("email", val.toString());
                }}
                searchPlaceholder="Search user..."
                clearable
                showSearch={true}
                withInput={false}
              />
            )}
          />
        </div>
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
            Add
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
