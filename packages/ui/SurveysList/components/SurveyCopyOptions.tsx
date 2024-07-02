import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TooltipRenderer } from "../../Tooltip";
import { getProductSurveyAction, getSurveytype } from "../actions";

interface Environment {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  environments: Environment[];
}

interface CopySurveyFormProps {
  surveyId: string;
  onSubmit: (
    data: { productId: string; targetenvironmentId: string; environmentType: string; productName: string }[]
  ) => void;
  onCancel: () => void;
}

const CopySurveyForm: React.FC<CopySurveyFormProps> = ({ surveyId, onSubmit, onCancel }) => {
  const { register, handleSubmit } = useForm();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<
    { productId: string; targetenvironmentId: string; environmentType: string; productName: string }[]
  >([]);
  const [surveyType, setSurveyType] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await getProductSurveyAction();
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
  const handleFormSubmit = () => {
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
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="relative mb-36 h-full w-full overflow-y-auto bg-white p-4">
      {products.map((product) => {
        const isDisabled = !surveyType!.includes(product.config.channel);
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
              <label className="block cursor-pointer pb-2 text-xl font-semibold text-black">
                {product.name}
                {isDisabled && <span className="ml-2 text-sm text-gray-500">(Disabled)</span>}
              </label>
            </TooltipRenderer>
            <div>
              {product.environments.map((environment) => (
                <div className="mb-2 flex items-center" key={environment.id}>
                  <input
                    type="checkbox"
                    id={`${environment.name}_${product.id}`}
                    {...register(`${environment.name}_${product.id}`)}
                    checked={selectedEnvironments.some(
                      (env) => env.productId === product.id && env.targetenvironmentId === environment.id
                    )}
                    onChange={handleCheckboxChange(
                      product.id,
                      environment.id,
                      environment.name,
                      product.name
                    )}
                    className="mr-2 h-4 w-4 appearance-none rounded-full border-gray-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
                    disabled={isDisabled}
                  />
                  <label
                    htmlFor={`${environment.name}_${product.id}`}
                    className={`text-lg capitalize text-gray-800 ${isDisabled ? "text-gray-400" : ""}`}>
                    {environment.name}
                  </label>
                </div>
              ))}
            </div>
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
        <button type="submit" className="h-12 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white">
          Copy Survey
        </button>
      </div>
    </form>
  );
};

export default CopySurveyForm;
