import BackgroundStylingCard from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/BackgroundStylingCard";
import CardStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/CardStylingSettings";
import FormStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/FormStylingSettings";
import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Switch } from "@formbricks/ui/Switch";

type StylingViewProps = {
  environment: TEnvironment;
  product: TProduct;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colors: string[];
};

const StylingView = ({ colors, environment, product, localSurvey, setLocalSurvey }: StylingViewProps) => {
  const overwriteUnifiedStyling = useMemo(() => {
    return !!localSurvey?.styling?.overwriteUnifiedStyling;
  }, [localSurvey?.styling?.overwriteUnifiedStyling]);

  const [styling, setStyling] = useState(() => {
    if (localSurvey.styling) {
      return localSurvey.styling;
    }

    const { allowStyleOverwrite, ...baseStyles } = product.styling;

    return {
      ...baseStyles,
      overwriteUnifiedStyling,
    };
  });

  const [productOverwrites, setProductOverwrites] = useState(localSurvey.productOverwrites);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [stylingOpen, setStylingOpen] = useState(false);

  const setOverwriteUnifiedStyling = (value: boolean) => {
    setStyling((prev) => ({ ...prev, overwriteUnifiedStyling: value }));
  };

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

  return (
    <div className="mt-12 space-y-3 p-5">
      <div className="flex items-center gap-4 py-4">
        <Switch checked={overwriteUnifiedStyling} onCheckedChange={setOverwriteUnifiedStyling} />
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-slate-900">Overwrite Unified Styling</h3>
          <p className="text-sm text-slate-800">
            Ignore the unified style settings and style this survey individually
          </p>
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
              Reset to unified styles
              <RotateCcwIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-500">
          To set unified styling, go to the{" "}
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
