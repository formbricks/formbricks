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
import { useDebounce } from "react-use";
import { z } from "zod";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface IndividualAddToWhitelistTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { email: string }[]) => void;
  membershipRole?: TOrganizationRole;
  organizationId: string;
}

export const IndividualAddToWhitelistTab = ({
  setOpen,
  onSubmit,
  organizationId,
}: IndividualAddToWhitelistTabProps) => {
  const [nonWhitelistedUsers, setNonWhitelistedUsers] = useState<TUserWhitelistInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useDebounce(
    () => {
      setDebouncedQuery(searchQuery);
    },
    300,
    [searchQuery]
  );

  const ZFormSchema = z.object({
    email: z.string(),
  });

  type TFormData = z.infer<typeof ZFormSchema>;
  const { t } = useTranslate();
  const form = useForm<TFormData>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {},
  });

  const {
    getValues,
    handleSubmit,
    setValue,
    reset,
    formState: { isSubmitting }, //, errors
  } = form;

  const submitEventClass = async () => {
    const data = getValues();
    onSubmit([data]);

    setOpen(false);
    reset();
  };

  const fetchNonWhitelistedUsers = useCallback(async () => {
    setLoading(true);
    const data = await getNonWhitelistedUsersAction({
      take: 10,
      skip: 0,
      organizationId: organizationId,
      query: debouncedQuery,
    });
    if (data && data.data) {
      setNonWhitelistedUsers(data.data);
    }
    setLoading(false);
  }, [debouncedQuery]);

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
              required: t("environments.whitelist.form.error.email_required"),
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
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                loading={loading}
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
