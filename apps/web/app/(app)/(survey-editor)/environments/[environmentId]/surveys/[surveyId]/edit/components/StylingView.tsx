import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys";
import { AlertDialog } from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { Switch } from "@formbricks/ui/Switch";

import { BackgroundStylingCard } from "./BackgroundStylingCard";
import { CardStylingSettings } from "./CardStylingSettings";
import { FormStylingSettings } from "./FormStylingSettings";

type StylingViewProps = {
  environment: TEnvironment;
  product: TProduct;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colors: string[];
  styling: TSurveyStyling | null;
  setStyling: React.Dispatch<React.SetStateAction<TSurveyStyling | null>>;
  localStylingChanges: TSurveyStyling | null;
  setLocalStylingChanges: React.Dispatch<React.SetStateAction<TSurveyStyling | null>>;
  isUnsplashConfigured: boolean;
};

export const StylingView = ({
  colors,
  environment,
  product,
  localSurvey,
  setLocalSurvey,
  setStyling,
  styling,
  localStylingChanges,
  setLocalStylingChanges,
  isUnsplashConfigured,
}: StylingViewProps) => {
  const [overwriteThemeStyling, setOverwriteThemeStyling] = useState(
    localSurvey?.styling?.overwriteThemeStyling ?? false
  );

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [stylingOpen, setStylingOpen] = useState(false);
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);

  const onResetThemeStyling = () => {
    const { styling: productStyling } = product;
    const { allowStyleOverwrite, ...baseStyling } = productStyling ?? {};

    setStyling({
      ...baseStyling,
      overwriteThemeStyling: true,
    });
    setConfirmResetStylingModalOpen(false);

    toast.success("Styling set to theme styles");
  };

  useEffect(() => {
    if (!overwriteThemeStyling) {
      setFormStylingOpen(false);
      setCardStylingOpen(false);
      setStylingOpen(false);
    }
  }, [overwriteThemeStyling]);

  useEffect(() => {
    if (styling) {
      setLocalSurvey((prev) => ({
        ...prev,
        styling,
      }));
    }
  }, [setLocalSurvey, styling]);

  const defaultProductStyling = useMemo(() => {
    const { styling: productStyling } = product;
    const { allowStyleOverwrite, ...baseStyling } = productStyling ?? {};

    return baseStyling;
  }, [product]);

  const handleOverwriteToggle = (value: boolean) => {
    // survey styling from the server is surveyStyling, it could either be set or not
    // if its set and the toggle is turned off, we set the local styling to the server styling

    setOverwriteThemeStyling(value);

    // if the toggle is turned on, we set the local styling to the product styling
    if (value) {
      if (!styling) {
        // copy the product styling to the survey styling
        setStyling({
          ...defaultProductStyling,
          overwriteThemeStyling: true,
        });
        return;
      }

      // if there are local styling changes, we set the styling to the local styling changes that were previously stored
      if (localStylingChanges) {
        setStyling(localStylingChanges);
      }
      // if there are no local styling changes, we set the styling to the product styling
      else {
        setStyling({
          ...defaultProductStyling,
          overwriteThemeStyling: true,
        });
      }
    }

    // if the toggle is turned off, we store the local styling changes and set the styling to the product styling
    else {
      // copy the styling to localStylingChanges
      setLocalStylingChanges(styling);

      // copy the product styling to the survey styling
      setStyling({
        ...defaultProductStyling,
        overwriteThemeStyling: false,
      });
    }
  };

  return (
    <div className="mt-12 space-y-3 p-5">
      <div className="flex items-center gap-4 py-4">
        <Switch checked={overwriteThemeStyling} onCheckedChange={handleOverwriteToggle} />
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
        disabled={!overwriteThemeStyling}
      />

      <CardStylingSettings
        open={cardStylingOpen}
        setOpen={setCardStylingOpen}
        styling={styling}
        setStyling={setStyling}
        surveyType={localSurvey.type}
        disabled={!overwriteThemeStyling}
        localProduct={product}
      />

      {localSurvey.type === "link" && (
        <BackgroundStylingCard
          open={stylingOpen}
          setOpen={setStylingOpen}
          styling={styling}
          setStyling={setStyling}
          environmentId={environment.id}
          colors={colors}
          disabled={!overwriteThemeStyling}
          isUnsplashConfigured={isUnsplashConfigured}
        />
      )}

      <div className="mt-4 flex h-8 items-center justify-between">
        <div>
          {overwriteThemeStyling && (
            <Button
              variant="minimal"
              className="flex items-center gap-2"
              onClick={() => setConfirmResetStylingModalOpen(true)}>
              Reset to theme styles
              <RotateCcwIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-500">
          Adjust the theme in the{" "}
          <Link
            href={`/environments/${environment.id}/product/look`}
            target="_blank"
            className="font-semibold underline">
            Look & Feel
          </Link>{" "}
          settings
        </p>
      </div>

      <AlertDialog
        open={confirmResetStylingModalOpen}
        setOpen={setConfirmResetStylingModalOpen}
        headerText="Reset to theme styles"
        mainText="Are you sure you want to reset the styling to the theme styles? This will remove all custom styling."
        confirmBtnLabel="Confirm"
        onDecline={() => setConfirmResetStylingModalOpen(false)}
        onConfirm={onResetThemeStyling}
      />
    </div>
  );
};
