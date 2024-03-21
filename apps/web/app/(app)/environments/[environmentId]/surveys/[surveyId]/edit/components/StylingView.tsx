import BackgroundStylingCard from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/BackgroundStylingCard";
import CardStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/CardStylingSettings";
import FormStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/FormStylingSettings";
import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Switch } from "@formbricks/ui/Switch";

type StylingViewProps = {
  environment: TEnvironment;
  product: TProduct;
  localSurvey: TSurvey;
  surveyStyling: TSurveyStyling | null;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colors: string[];
};

const StylingView = ({
  colors,
  environment,
  product,
  localSurvey,
  setLocalSurvey,
  surveyStyling,
}: StylingViewProps) => {
  const [overwriteUnifiedStyling, setOverwriteUnifiedStyling] = useState(
    localSurvey?.styling?.overwriteUnifiedStyling ?? false
  );

  const [styling, setStyling] = useState(localSurvey.styling);
  const [localStylingChanges, setLocalStylingChanges] = useState(localSurvey.styling);

  const [productOverwrites, setProductOverwrites] = useState(localSurvey.productOverwrites);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [stylingOpen, setStylingOpen] = useState(false);

  const onResetUnifiedStyling = () => {
    const { styling: productStyling } = product;
    const { allowStyleOverwrite, ...baseStyling } = productStyling ?? {};

    setStyling(baseStyling);

    toast.success("Styling set to unified styles");
  };

  useEffect(() => {
    if (!overwriteUnifiedStyling) {
      setFormStylingOpen(false);
      setCardStylingOpen(false);
      setStylingOpen(false);
    }
  }, [overwriteUnifiedStyling]);

  useEffect(() => {
    if (styling) {
      setLocalSurvey((prev) => ({
        ...prev,
        styling,
      }));
    }

    if (productOverwrites) {
      setLocalSurvey((prev) => ({ ...prev, productOverwrites }));
    }
  }, [productOverwrites, setLocalSurvey, styling]);

  const defaultProductStyling = useMemo(() => {
    const { styling: productStyling } = product;
    const { allowStyleOverwrite, ...baseStyling } = productStyling ?? {};

    return baseStyling;
  }, [product]);

  const handleOverwriteToggle = (value: boolean) => {
    // survey styling from the server is surveyStyling, it could either be set or not
    // if its set and the toggle is turned off, we set the local styling to the server styling

    setOverwriteUnifiedStyling(value);

    if (value) {
      if (!styling) {
        // copy the product styling to the survey styling
        setStyling({
          ...defaultProductStyling,
          overwriteUnifiedStyling: true,
        });
        return;
      }

      // if the local styling changes are not equal to the survey styling, we set the local styling to the survey styling
      if (surveyStyling && JSON.stringify(localStylingChanges) !== JSON.stringify(surveyStyling)) {
        setStyling(localStylingChanges);
      } else {
        setStyling({
          ...defaultProductStyling,
          overwriteUnifiedStyling: true,
        });
      }
    } else {
      // copy the styling to localStylingChanges
      setLocalStylingChanges(styling);

      // copy the product styling to the survey styling
      setStyling({
        ...defaultProductStyling,
        overwriteUnifiedStyling: false,
      });
    }
  };

  return (
    <div className="mt-12 space-y-3 p-5">
      <div className="flex items-center gap-4 py-4">
        <Switch checked={overwriteUnifiedStyling} onCheckedChange={handleOverwriteToggle} />
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-slate-900">Add custom styles</h3>
          <p className="text-sm text-slate-800">Override the theme with individual styles for this survey.</p>
        </div>
      </div>

      <FormStylingSettings
        open={formStylingOpen}
        setOpen={setFormStylingOpen}
        styling={styling}
        setStyling={setStyling}
        disabled={!overwriteUnifiedStyling}
      />

      <CardStylingSettings
        open={cardStylingOpen}
        setOpen={setCardStylingOpen}
        styling={styling}
        setStyling={setStyling}
        productOverwrites={productOverwrites}
        setProductOverwrites={setProductOverwrites}
        disabled={!overwriteUnifiedStyling}
      />

      {localSurvey.type === "link" && (
        <BackgroundStylingCard
          open={stylingOpen}
          setOpen={setStylingOpen}
          styling={styling}
          setStyling={setStyling}
          environmentId={environment.id}
          colors={colors}
          disabled={!overwriteUnifiedStyling}
        />
      )}

      <div className="mt-4 flex h-8 items-center justify-between">
        <div>
          {overwriteUnifiedStyling && (
            <Button variant="minimal" className="flex items-center gap-2" onClick={onResetUnifiedStyling}>
              Reset to theme styles
              <RotateCcwIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-500">
          Adjust the theme in the{" "}
          <Link
            href={`/environments/${environment.id}/settings/lookandfeel`}
            target="_blank"
            className="font-semibold underline">
            Look & Feel
          </Link>{" "}
          settings
        </p>
      </div>
    </div>
  );
};

export default StylingView;
