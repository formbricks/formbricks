"use client";

import { Control, Controller, UseFormSetValue } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TIntegrationItem } from "@formbricks/types/integration";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { IntegrationModalInputs } from "../lib/types";

interface BaseSelectProps {
  readonly control: Control<IntegrationModalInputs, any>;
  readonly isLoading: boolean;
  readonly fetchTable: (val: string) => Promise<void>;
  readonly airtableArray: TIntegrationItem[];
  readonly setValue: UseFormSetValue<IntegrationModalInputs>;
  readonly defaultValue: string | undefined;
}

export const BaseSelectDropdown = ({
  airtableArray,
  control,
  fetchTable,
  isLoading,
  setValue,
  defaultValue,
}: BaseSelectProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex w-full flex-col">
      <Label htmlFor="base">{t("workspace.integrations.airtable.airtable_base")}</Label>
      <div className="mt-1 flex">
        <Controller
          control={control}
          name="base"
          render={({ field }) => (
            <Select
              required
              disabled={isLoading}
              onValueChange={async (val) => {
                field.onChange(val);
                await fetchTable(val);
                setValue("table", "");
              }}
              defaultValue={defaultValue}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {airtableArray.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
};
