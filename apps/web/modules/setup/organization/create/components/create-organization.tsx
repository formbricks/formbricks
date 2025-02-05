"use client";

import { createOrganizationAction } from "@/app/setup/organization/create/actions";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormProvider } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { ZOrganization } from "@formbricks/types/organizations";

const ZCreateOrganizationFormSchema = ZOrganization.pick({ name: true });
type TCreateOrganizationForm = z.infer<typeof ZCreateOrganizationFormSchema>;

export const CreateOrganization = () => {
  const { t } = useTranslate();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TCreateOrganizationForm>({
    defaultValues: {
      name: "",
    },
    mode: "onChange",
    resolver: zodResolver(ZCreateOrganizationFormSchema),
  });

  const organizationName = form.watch("name");

  const onSubmit: SubmitHandler<TCreateOrganizationForm> = async () => {
    try {
      setIsSubmitting(true);
      const createOrganizationResponse = await createOrganizationAction({ organizationName });
      if (createOrganizationResponse?.data) {
        router.push(`/setup/organization/${createOrganizationResponse.data.id}/invite`);
      }
    } catch (error) {
      toast.error("Some error occurred while creating organization");
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit(onSubmit)(e);
        }}>
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-medium">{t("setup.organization.create.title")}</h2>
          <p>{t("setup.organization.create.description")}</p>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    isInvalid={Boolean(form.formState.errors.name)}
                    placeholder="e.g., Acme Inc"
                    className="w-80"
                    required
                  />
                </FormControl>

                <FormError />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="flex w-80 justify-center"
            loading={isSubmitting}
            disabled={isSubmitting || organizationName.trim() === ""}>
            {t("setup.organization.create.continue")}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
