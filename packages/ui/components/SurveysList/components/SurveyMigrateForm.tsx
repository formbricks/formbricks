import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TProduct } from "@formbricks/types/product";
import {
  TSurvey,
  TSurveyMigrateFormData,
  ZSurveyMigrateFormValidation,
} from "@formbricks/types/surveys/types";
import { Button } from "../../Button";
import { FormField, FormProvider } from "../../Form";
import { Label } from "../../Label";
import { RadioGroup, RadioGroupItem } from "../../RadioGroup";
import { TooltipRenderer } from "../../Tooltip";
import { migrateSurveyToOtherEnvironmentAction } from "../actions";

// Import useState

export const SurveyMigrateForm = ({
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
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);

  const form = useForm<TSurveyMigrateFormData>({
    resolver: zodResolver(ZSurveyMigrateFormValidation),
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

  const onSubmit = async () => {
    if (!selectedEnvironmentId) {
      toast.error("Please select an environment to migrate the survey to");
      return;
    }
    try {
      const result = await migrateSurveyToOtherEnvironmentAction({
        surveyId: survey.id,
        targetEnvironmentId: selectedEnvironmentId,
      });

      if (result?.serverError) {
        throw new Error("Server Error while trying to migrate the survey.");
      }
      toast.success("Survey migrated successfully!");
    } catch (error) {
      toast.error("Failed to migrate survey");
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
          <RadioGroup>
            {formFields.fields.map((field, productIndex) => {
              const product = defaultProducts.find((product) => product.id === field.product);
              const isDisabled = survey.type !== "link" && product?.config.channel !== survey.type;

              return (
                <div key={product?.id}>
                  <div className="mb-4 flex flex-col gap-2">
                    <TooltipRenderer
                      shouldRender={isDisabled}
                      tooltipContent={
                        <span>
                          This product is not compatible with the survey type. Please select a different
                          product.
                        </span>
                      }>
                      <div className="w-fit">
                        <p className="text-base font-semibold text-slate-900">
                          {product?.name}
                          {isDisabled && <span className="ml-2 mr-11 text-sm text-gray-500">(Disabled)</span>}
                        </p>
                      </div>
                    </TooltipRenderer>

                    <div className="flex flex-col gap-2">
                      {product?.environments.map((environment) => {
                        return (
                          <FormField
                            key={environment.id}
                            control={form.control}
                            name={`products.${productIndex}.environments`}
                            render={({ field }) => {
                              // Skip the current environment
                              if (environment.id === survey.environmentId) {
                                return <></>;
                              }
                              return (
                                <div className="flex items-center space-x-2 whitespace-nowrap">
                                  <RadioGroupItem
                                    {...field}
                                    onClick={() => {
                                      if (!isDisabled) {
                                        setSelectedEnvironmentId(environment.id);
                                      }
                                    }}
                                    className="mr-2 h-4 w-4 appearance-none border-gray-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                                    disabled={isDisabled}
                                    id={environment.id}
                                    value={environment.id}
                                  />
                                  <Label htmlFor={environment.id}>
                                    <p className="text-sm font-medium capitalize text-slate-900">
                                      {environment.type}
                                    </p>
                                  </Label>
                                </div>
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
          </RadioGroup>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-10 flex w-full justify-end space-x-2 bg-white">
          <div className="flex w-full justify-end pb-4 pr-4">
            <Button type="button" onClick={onCancel} variant="minimal">
              Cancel
            </Button>

            <Button variant="primary" type="submit">
              Migrate survey
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
