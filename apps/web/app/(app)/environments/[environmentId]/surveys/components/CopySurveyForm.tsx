"use client";

import { copySurveyToOtherEnvironmentAction } from "@/app/(app)/environments/[environmentId]/surveys/actions";
import {
  TSurvey,
  TSurveyCopyFormData,
  ZSurveyCopyFormValidation,
} from "@/app/(app)/environments/[environmentId]/surveys/types/surveys";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/components/Button";
import { Checkbox } from "@formbricks/ui/components/Checkbox";
import { FormControl, FormField, FormItem, FormProvider } from "@formbricks/ui/components/Form";
import { Label } from "@formbricks/ui/components/Label";

export const CopySurveyForm = ({
  defaultProducts,
  survey,
  onCancel,
  setOpen,
}: {
  defaultProducts: TProduct[];
  survey: TSurvey;
  onCancel: () => void;
  setOpen: (value: boolean) => void;
}) => {
  const t = useTranslations();
  const form = useForm<TSurveyCopyFormData>({
    resolver: zodResolver(ZSurveyCopyFormValidation),
    defaultValues: {
      products: defaultProducts.map((product) => ({
        product: product.id,
        environments: [],
      })),
    },
  });

  const formFields = useFieldArray({
    name: "products",
    control: form.control,
  });

  const onSubmit = async (data: TSurveyCopyFormData) => {
    const filteredData = data.products.filter((product) => product.environments.length > 0);

    try {
      filteredData.map(async (product) => {
        product.environments.map(async (environment) => {
          await copySurveyToOtherEnvironmentAction({
            environmentId: survey.environmentId,
            surveyId: survey.id,
            targetEnvironmentId: environment,
          });
        });
      });
      toast.success(t("environments.surveys.copy_survey_success"));
    } catch (error) {
      toast.error(t("environments.surveys.copy_survey_error"));
    } finally {
      setOpen(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="relative flex h-full w-full flex-col gap-8 overflow-y-auto bg-white p-4">
        <div className="space-y-8 pb-12">
          {formFields.fields.map((field, productIndex) => {
            const product = defaultProducts.find((product) => product.id === field.product);

            return (
              <div key={product?.id}>
                <div className="flex flex-col gap-4">
                  <div className="w-fit">
                    <p className="text-base font-semibold text-slate-900">{product?.name}</p>
                  </div>

                  <div className="flex flex-col gap-4">
                    {product?.environments.map((environment) => {
                      return (
                        <FormField
                          key={environment.id}
                          control={form.control}
                          name={`products.${productIndex}.environments`}
                          render={({ field }) => {
                            return (
                              <FormItem>
                                <div className="flex items-center">
                                  <FormControl>
                                    <>
                                      <Checkbox
                                        {...field}
                                        type="button"
                                        onCheckedChange={() => {
                                          if (field.value.includes(environment.id)) {
                                            field.onChange(
                                              field.value.filter((id: string) => id !== environment.id)
                                            );
                                          } else {
                                            field.onChange([...field.value, environment.id]);
                                          }
                                        }}
                                        className="mr-2 h-4 w-4 appearance-none border-slate-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                                        id={environment.id}
                                      />
                                      <Label htmlFor={environment.id}>
                                        <p className="text-sm font-medium capitalize text-slate-900">
                                          {environment.type}
                                        </p>
                                      </Label>
                                    </>
                                  </FormControl>
                                </div>
                              </FormItem>
                            );
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-10 flex w-full justify-end space-x-2 bg-white">
          <div className="flex w-full justify-end pb-4 pr-4">
            <Button type="button" onClick={onCancel} variant="minimal">
              {t("common.cancel")}
            </Button>

            <Button variant="primary" type="submit">
              {t("environments.surveys.copy_survey")}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
