"use client";

import { ColorPicker } from "@/components/settings/ColorPicker";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { useEnvironment } from "@/lib/environments";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Switch } from "@/components/ui/Switch";

export function EditBrandColor({ environmentId }) {
  const { isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }
  if (isErrorEnvironment) {
    return <div>Error</div>;
  }

  return (
    <div className="w-full max-w-sm items-center">
      <Label htmlFor="brandcolor">Color (HEX)</Label>
      <ColorPicker attribute="colorButtonText" />
      <Button type="submit" className="mt-4">
        Save
      </Button>
      {/*   <div className="whitespace-pre-wrap">{JSON.stringify(environment, null, 2)}</div>; */}
    </div>
  );
}

export function EditPlacement({ environmentId }) {
  const { isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }
  if (isErrorEnvironment) {
    return <div>Error</div>;
  }

  const placements = [
    { name: "Bottom Right", value: "bottomRight", default: true, disabled: false },
    { name: "Top Right", value: "bottomRight", default: false, disabled: true },
    { name: "Top Left", value: "bottomRight", default: false, disabled: true },
    { name: "Bottom Leftt", value: "bottomRight", default: false, disabled: true },
    { name: "Centered Modal", value: "bottomRight", default: false, disabled: true },
  ];

  return (
    <div className="w-full items-center">
      <div className="flex">
        <RadioGroup>
          {placements.map((placement) => (
            <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
              <RadioGroupItem
                id={placement.value}
                value={placement.value}
                checked={placement.default}
                disabled={placement.disabled}
              />
              <Label htmlFor={placement.value}>{placement.name}</Label>
            </div>
          ))}
        </RadioGroup>
        <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
          <div className="absolute top-3 right-3 h-16 w-16 rounded bg-slate-700"></div>
        </div>
      </div>
      <Button type="submit" className="mt-4" disabled>
        Save
      </Button>
      {/*   <div className="whitespace-pre-wrap">{JSON.stringify(environment, null, 2)}</div>; */}
    </div>
  );
}

export function EditFormbricksSignature({ environmentId }) {
  const { isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }
  if (isErrorEnvironment) {
    return <div>Error</div>;
  }

  return (
    <div className="w-full items-center">
      <div className="flex items-center space-x-2">
        <Switch disabled id="signature" />
        <Label htmlFor="signature">Show Formbricks Signature</Label>
      </div>
      <Button type="submit" className="mt-4" disabled>
        Save
      </Button>
      {/*   <div className="whitespace-pre-wrap">{JSON.stringify(environment, null, 2)}</div>; */}
    </div>
  );
}
