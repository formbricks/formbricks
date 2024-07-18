import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TProduct } from "@formbricks/types/product";
import { CopySurveyFormValidation, TCopySurveyFormData, TSurvey } from "@formbricks/types/surveys";
import { Button } from "../../Button";
import { Checkbox } from "../../Checkbox";
import { FormControl, FormField, FormItem, FormProvider } from "../../Form";
import { TooltipRenderer } from "../../Tooltip";
import { copyToOtherEnvironmentAction, getProductSurveyAction } from "../actions";

interface SurveyCopyOptionsProps {
  survey: TSurvey;
  environmentId: string;
  onCancel: () => void;
  setOpen: (value: boolean) => void;
}

const SurveyCopyOptions = ({ environmentId, survey, onCancel, setOpen }: SurveyCopyOptionsProps) => {
  const [products, setProducts] = useState<TProduct[]>([]);
  const [productLoading, setProductLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await getProductSurveyAction(environmentId);
        setProducts(products);
      } catch (error) {
        toast.error("Error fetching products");
      } finally {
        setProductLoading(false);
      }
    };

    fetchProducts();
  }, [environmentId]);

  if (productLoading) {
    return (
      <div className="relative flex h-full min-h-96 w-full items-center justify-center bg-white pb-12">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return <CopySurveyForm defaultProducts={products} survey={survey} onCancel={onCancel} setOpen={setOpen} />;
};

const CopySurveyForm = ({
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
  const form = useForm<TCopySurveyFormData>({
    resolver: zodResolver(CopySurveyFormValidation),
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

  const onSubmit = async (data: TCopySurveyFormData) => {
    const filteredData = data.products.filter((product) => product.environments.length > 0);

    try {
      filteredData.map(async (product) => {
        product.environments.map(async (environment) => {
          await copyToOtherEnvironmentAction(survey.environmentId, survey.id, environment, product.product);
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
                      This product is not compatible with the survey type. Please select a different product.
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
                                      className="mr-2 h-4 w-4 appearance-none rounded-full border-gray-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                                      disabled={isDisabled}
                                    />
                                    <p className="text-sm font-medium capitalize text-slate-900">
                                      {environment.type}
                                    </p>
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
        <div className="relative bottom-4 right-4 flex justify-end space-x-2">
          <Button type="button" onClick={onCancel} variant="minimal">
            Cancel
          </Button>

          <Button variant="darkCTA" type="submit">
            Copy survey
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export default SurveyCopyOptions;
