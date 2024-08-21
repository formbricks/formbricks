import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyCopyFormData, ZSurveyCopyFormValidation } from "@formbricks/types/surveys/types";
import { Button } from "../../Button";
import { Checkbox } from "../../Checkbox";
import { FormControl, FormField, FormItem, FormProvider } from "../../Form";
import { Label } from "../../Label";
import { TooltipRenderer } from "../../Tooltip";
import { copySurveyToOtherEnvironmentAction } from "../actions";

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

      toast.success("Survey copied successfully!");
    } catch (error) {
      toast.error("Failed to copy survey");
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
            const isDisabled = survey.type !== "link" && product?.config.channel !== survey.type;

            return (
              <div key={product?.id}>
                <div className="flex flex-col gap-4">
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

                  <div className="flex flex-col gap-4">
                    {product?.environments.map((environment) => {
                      return (
                        <FormField
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
                                        onClick={(e) => {
                                          if (isDisabled) {
                                            e.preventDefault();
                                          }
                                        }}
                                        onCheckedChange={() => {
                                          if (field.value.includes(environment.id)) {
                                            field.onChange(
                                              field.value.filter((id: string) => id !== environment.id)
                                            );
                                          } else {
                                            field.onChange([...field.value, environment.id]);
                                          }
                                        }}
                                        className="mr-2 h-4 w-4 appearance-none border-gray-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                                        disabled={isDisabled}
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
              Cancel
            </Button>

            <Button variant="primary" type="submit">
              Copy survey
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
