import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getProductsByEnvironmentIdAction } from "../actions";
import { SurveyMigrateForm } from "./SurveyMigrateForm";

interface SurveyMigrateOptionsProps {
  survey: TSurvey;
  onCancel: () => void;
  setOpen: (value: boolean) => void;
  onMigrated: (surveyId: string) => void;
}

const SurveyMigrateOptions = ({ survey, onCancel, setOpen, onMigrated }: SurveyMigrateOptionsProps) => {
  const [products, setProducts] = useState<TProduct[]>([]);
  const [productLoading, setProductLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const getProductsByEnvironmentIdResponse = await getProductsByEnvironmentIdAction({
        environmentId: survey.environmentId,
      });
      if (getProductsByEnvironmentIdResponse?.data) {
        setProducts(getProductsByEnvironmentIdResponse?.data);
      } else {
        const errorMessage = getFormattedErrorMessage(getProductsByEnvironmentIdResponse);
        toast.error(errorMessage);
      }

      setProductLoading(false);
    };

    fetchProducts();
  }, [survey.environmentId]);

  if (productLoading) {
    return (
      <div className="relative flex h-full min-h-96 w-full items-center justify-center bg-white pb-12">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <SurveyMigrateForm
      defaultProducts={products}
      survey={survey}
      onCancel={onCancel}
      setOpen={setOpen}
      onMigrated={onMigrated}
    />
  );
};

export default SurveyMigrateOptions;
