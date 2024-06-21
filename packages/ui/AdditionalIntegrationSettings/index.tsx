import { Checkbox } from "../Checkbox";
import { Label } from "../Label";

interface AdditionalIntegrationSettingsProps {
  includeHiddenFields: boolean;
  includeMetadata: boolean;
  setIncludeHiddenFields: (includeHiddenFields: boolean) => void;
  setIncludeMetadata: (includeHiddenFields: boolean) => void;
}

export const AdditionalIntegrationSettings = ({
  includeHiddenFields,
  includeMetadata,
  setIncludeHiddenFields,
  setIncludeMetadata,
}: AdditionalIntegrationSettingsProps) => {
  return (
    <div className="mt-4">
      <Label htmlFor="Surveys">Additional Settings</Label>
      <div className="text-sm">
        <div className="my-1 flex items-center space-x-2">
          <label htmlFor={"includeHiddenFields"} className="flex cursor-pointer items-center">
            <Checkbox
              type="button"
              id={"includeHiddenFields"}
              value={"includeHiddenFields"}
              className="bg-white"
              checked={includeHiddenFields}
              onCheckedChange={() => {
                setIncludeHiddenFields(!includeHiddenFields);
              }}
            />
            <span className="ml-2 w-[30rem] truncate">Include Hidden Fields</span>
          </label>
        </div>
        <div className="my-1 flex items-center space-x-2">
          <label htmlFor={"includeMetadata"} className="flex cursor-pointer items-center">
            <Checkbox
              type="button"
              id={"includeMetadata"}
              value={"includeMetadata"}
              className="bg-white"
              checked={includeMetadata}
              onCheckedChange={() => {
                setIncludeMetadata(!includeMetadata);
              }}
            />
            <span className="ml-2 w-[30rem] truncate">Include Metadata (Browser, Country, etc.)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
