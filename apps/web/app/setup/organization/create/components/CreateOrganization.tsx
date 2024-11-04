"use client";

import { createOrganizationAction } from "@/app/setup/organization/create/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { ZOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/components/Button";
import { FormControl, FormError, FormField, FormItem, FormProvider } from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";

const ZCreateOrganizationFormSchema = ZOrganization.pick({ name: true });
type TCreateOrganizationForm = z.infer<typeof ZCreateOrganizationFormSchema>;

export const CreateOrganization = () => {
  const t = useTranslations();
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

  const onSubmit: SubmitHandler<TCreateOrganizationForm> = async (data) => {
    try {
      setIsSubmitting(true);
      const organizationName = data.name.trim();
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
      <form onSubmit={form.handleSubmit(onSubmit)}>
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
                    isInvalid={!!form.formState.errors.name}
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
