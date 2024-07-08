import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";
import { TEnvironment } from "@formbricks/types/environment";
import { TProductConfigChannel } from "@formbricks/types/product";
import { CopySurveyFormValidation, TCopySurveyFormData, TSurvey } from "@formbricks/types/surveys";
import { Button } from "../../Button";
import { FormControl, FormError, FormField, FormItem, FormLabel, FormProvider } from "../../Form";
import { TooltipRenderer } from "../../Tooltip";
import { getProductSurveyAction, getSurveytype } from "../actions";

interface Product {
  id: string;
  name: string;
  environments: TEnvironment[];
  config: {
    channel: TProductConfigChannel;
  };
}

interface CopySurveyFormProps {
  surveyId: string;
  environmentId: string;
  onSubmit: (
    data: { productId: string; targetenvironmentId: string; environmentType: string; productName: string }[]
  ) => void;
  onCancel: () => void;
}

const CopySurveyForm: React.FC<CopySurveyFormProps> = ({ environmentId, surveyId, onSubmit, onCancel }) => {
  // const { register, handleSubmit } = useForm();
  // const methods = useForm<TCopySurveyFormData>({
  //   defaultValues: [],
  //   resolver: zodResolver(CopySurveyFormValidation),
  // });

  // validating the form data using CopySurveyFormValidation.safeParse(selectedEnvironments)  handleFormSubmit function.
  const methods = useForm<TCopySurveyFormData>({
    resolver: zodResolver(CopySurveyFormValidation),
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<TCopySurveyFormData>([]);
  const [surveyType, setSurveyType] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await getProductSurveyAction(environmentId);
        console.log("products", products);
        setProducts(products);
      } catch (error) {
        toast.error("Error fetching products");
      } finally {
        setLoading(false); // Set loading to false once products are fetched
      }
    };

    const fetchSurveyTypes = async () => {
      try {
        const type = await getSurveytype(surveyId); // Pass surveyId in the POST request
        setSurveyType(type);
      } catch (error) {
        toast.error("Error fetching survey types");
      }
    };
    fetchSurveyTypes();
    fetchProducts();
  }, [surveyId]);

  const handleCheckboxChange =
    (productId: string, targetenvironmentId: string, environmentType: string, productName: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const isChecked = e.target.checked;

      if (isChecked) {
        setSelectedEnvironments((prevSelected) => {
          const isAlreadySelected = prevSelected.some(
            (env) => env.productId === productId && env.targetenvironmentId === targetenvironmentId
          );

          if (isAlreadySelected) {
            return prevSelected.filter(
              (env) => !(env.productId === productId && env.targetenvironmentId === targetenvironmentId)
            );
          } else {
            return [...prevSelected, { productId, targetenvironmentId, environmentType, productName }];
          }
        });
      } else {
        setSelectedEnvironments((prevSelected) =>
          prevSelected.filter(
            (env) => !(env.productId === productId && env.targetenvironmentId === targetenvironmentId)
          )
        );
      }
    };

  // validating the form data using CopySurveyFormValidation.safeParse(selectedEnvironments)  handleFormSubmit function.
  const handleFormSubmit = async () => {
    // Manually validate data with Zod schema
    const validationResult = CopySurveyFormValidation.safeParse(selectedEnvironments);
    if (!validationResult.success) {
      console.log("validate", validationResult.error);
      console.error(validationResult.error);
      toast.error("Validation error!");
      return;
    }
    console.log("hereee");
    onSubmit(selectedEnvironments);
  };
  if (loading) {
    return (
      <div className="relative mb-96 flex h-full w-full items-center justify-center bg-white pb-12">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleFormSubmit)}
        className="relative mb-36 h-full w-full overflow-y-auto bg-white p-4">
        {products.map((product, productIndex) => {
          const isDisabled = !surveyType?.includes(product.config.channel!);
          return (
            <div key={product.id} className="mb-11 ml-8">
              <TooltipRenderer
                key={product.id}
                shouldRender={isDisabled}
                tooltipContent={
                  <span>
                    This product is not compatible with the survey type. Please select a different product.
                  </span>
                }>
                <FormField
                  control={methods.control}
                  name={`${productIndex}.productId`}
                  render={({ field, fieldState: { error } }) => (
                    <FormItem className="w-full space-y-4">
                      <div>
                        <FormLabel className="block text-xl font-semibold text-black">
                          {product.name}
                          {isDisabled && <span className="ml-2 mr-11 text-sm text-gray-500">(Disabled)</span>}
                        </FormLabel>
                      </div>
                      <FormControl>
                        <div>
                          {product.environments.map((environment) => (
                            <div className="mb-2 flex items-center" key={environment.id}>
                              <input
                                type="checkbox"
                                id={`${environment.type}_${product.id}`}
                                {...field}
                                checked={selectedEnvironments.some(
                                  (env) =>
                                    env.productId === product.id && env.targetenvironmentId === environment.id
                                )}
                                onChange={handleCheckboxChange(
                                  product.id,
                                  environment.id,
                                  environment.type,
                                  product.name
                                )}
                                className="mr-2 h-4 w-4 appearance-none rounded-full border-gray-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                                disabled={isDisabled}
                              />
                              <label
                                htmlFor={`${environment.type}_${product.id}`}
                                className={`text-lg capitalize text-gray-800 ${isDisabled ? "text-gray-400" : ""}`}>
                                {environment.type}
                              </label>
                            </div>
                          ))}
                          {error?.message && <FormError className="text-left">{error.message}</FormError>}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TooltipRenderer>
            </div>
          );
        })}
        <div className="relative bottom-4 right-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="mr-2 rounded-md bg-transparent px-4 py-2 font-semibold text-slate-600">
            Cancel
          </button>
          {/* <button type="submit"  className="h-12 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">
            Copy Survey
          </button> */}
          <Button variant="darkCTA" type="submit">
            Copy survey
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export default CopySurveyForm;
